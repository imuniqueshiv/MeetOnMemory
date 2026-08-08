import React, { useState, useContext, useEffect } from "react";
import Navbar from "../components/Navbar.jsx";
import { toast } from "react-toastify";
import { userApi } from "../services";
import AppContent from "../context/AppContent";
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
} from "lucide-react";

const Profile = () => {
  const { userData, setUserData } = useContext(AppContent);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profilePicFailed, setProfilePicFailed] = useState(false);

  useEffect(() => {
    setProfilePicFailed(false);
  }, [userData?.profilePic]);

  // Form State
  const [name, setName] = useState("");
  const [profilePic, setProfilePic] = useState("");
  const [bio, setBio] = useState("");

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
      setBio(userData.bio || "");
    }
  }, [userData]);

  if (!userData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex justify-center items-center">
          <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
          <span className="ml-3 text-slate-500 font-medium">
            Loading profile...
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
      newErrors.name = "Full Name is required.";
      isValid = false;
    } else if (name.trim().length < 2) {
      newErrors.name = "Full Name must be at least 2 characters.";
      isValid = false;
    }

    if (profilePic.trim()) {
      try {
        const u = new URL(profilePic.trim());
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          newErrors.profilePic = "Image URL must use http or https.";
          isValid = false;
        }
      } catch {
        newErrors.profilePic =
          "Please enter a valid URL (starting with http:// or https://).";
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  // Save changes handler
  const handleSave = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const { data } = await userApi.updateProfile({
        name: name.trim(),
        profilePic: profilePic.trim(),
        bio: bio.trim(),
      });

      if (data.success) {
        toast.success(data.message || "Profile updated successfully!");
        setUserData(data.user);
        localStorage.setItem("userData", JSON.stringify(data.user));
        setIsEditing(false);
      } else {
        toast.error(data.message || "Failed to update profile.");
      }
    } catch (err) {
      console.error("Profile update error:", err);
      const msg =
        err.response?.data?.message || "Server error while updating profile.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Discard changes / Reset form
  const handleCancel = () => {
    setName(userData.name || "");
    setProfilePic(userData.profilePic || "");
    setBio(userData.bio || "");
    setErrors({ name: "", profilePic: "" });
    setIsEditing(false);
  };

  // Formatted date string (e.g. Mar 2025)
  const formattedMemberSince = userData.createdAt
    ? new Date(userData.createdAt).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : "N/A";

  const displayRole = userData.role
    ? userData.role.charAt(0).toUpperCase() +
      userData.role.slice(1).toLowerCase()
    : "Member";

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-200 flex flex-col font-sans select-none">
      <Navbar />

      <div className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 flex flex-col justify-center">
        {/* Page title header */}
        <div className="text-center mb-8 fade-in-up stagger-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            User Profile
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm max-w-md mx-auto">
            Manage your personal credentials, view your organization link, and
            customize your bio.
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
                        toast.warning(
                          "Failed to load custom profile image. Displaying initials fallback.",
                        );
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
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                          <ShieldAlert className="w-3 h-3 text-amber-600" />
                          Unverified
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
                  Edit profile
                </button>
              </div>

              {/* Grid details section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-8 py-2 text-slate-600 dark:text-slate-400">
                <div className="space-y-1.5">
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-slate-400" />
                    Email
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-200 break-all">
                    {userData.email}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    Organization
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                    {userData.organization?.name || "No Organization"}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3 h-3 text-slate-400" />
                    Role
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-200 capitalize">
                    {displayRole}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    Member since
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                    {formattedMemberSince}
                  </div>
                </div>
              </div>

              {/* Bio section */}
              <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                  Bio
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed italic">
                  {userData.bio || "No bio added yet. Tell us about yourself!"}
                </p>
              </div>
            </div>
          ) : (
            // ================= EDIT STATE =================
            <form onSubmit={handleSave} className="space-y-6">
              <div className="pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Edit Profile Details
                </h3>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  aria-label="Cancel editing"
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
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="name-input"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your Full Name"
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

                {/* Profile Picture URL input */}
                <div className="space-y-2">
                  <label
                    htmlFor="pic-input"
                    className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                  >
                    Profile Picture URL
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      id="pic-input"
                      type="text"
                      value={profilePic}
                      onChange={(e) => setProfilePic(e.target.value)}
                      placeholder="https://example.com/avatar.jpg"
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
                    Bio (Optional)
                  </label>
                  <textarea
                    id="bio-input"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us about yourself..."
                    disabled={loading}
                    rows="3"
                    maxLength="250"
                    className="w-full bg-slate-50/50 dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 rounded-xl py-2.5 px-4 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 transition-all outline-none resize-none"
                  />
                  <div className="flex justify-end text-[10px] text-slate-400 font-bold">
                    {bio.length}/250 characters
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
                  Cancel
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
                      Save Changes
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
