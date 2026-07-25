import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Building2,
  Shield,
  Globe,
  Mail,
  MapPin,
  Briefcase,
  FileText,
  Info,
  Calendar,
  Users,
  Copy,
  Check,
  Save,
  RotateCcw,
  Loader2,
  ChevronRight,
  AlertCircle,
  Lock,
  ExternalLink,
} from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import AppContent from "../context/AppContent";
import { organizationApi } from "../services/organizationApi.js";

const OrganizationSettings = () => {
  const navigate = useNavigate();
  const { getUserData, setUserData } = useContext(AppContent);

  // Loading & state management
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [userRole, setUserRole] = useState("member");
  const [canEdit, setCanEdit] = useState(false);

  // Original fetched data for dirty state detection
  const [initialData, setInitialData] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    about: "",
    website: "",
    contactEmail: "",
    industry: "",
    location: "",
    visibility: "private",
    joinPolicy: "open",
  });

  // Metadata State
  const [metadata, setMetadata] = useState({
    _id: "",
    slug: "",
    createdAt: null,
    updatedAt: null,
    owner: null,
    memberCount: 0,
  });

  // Validation Errors
  const [errors, setErrors] = useState({});

  // Industry options
  const industryOptions = [
    "Technology & Software",
    "Education & Academics",
    "Healthcare & Life Sciences",
    "Financial Services",
    "Marketing & Advertising",
    "Non-Profit & Community",
    "Media & Entertainment",
    "Professional Services",
    "Real Estate",
    "Retail & E-commerce",
    "Manufacturing",
    "Other",
  ];

  // Fetch organization settings
  const fetchOrgSettings = async () => {
    try {
      setLoading(true);
      const { data } = await organizationApi.getOrganizationSettings();

      if (data.success && data.organization) {
        const org = data.organization;
        const loadedForm = {
          name: org.name || "",
          description: org.description || "",
          about: org.about || "",
          website: org.website || "",
          contactEmail: org.contactEmail || "",
          industry: org.industry || "",
          location: org.location || "",
          visibility: org.visibility || "private",
          joinPolicy: org.joinPolicy || "open",
        };

        setFormData(loadedForm);
        setInitialData(loadedForm);

        setMetadata({
          _id: org._id || "",
          slug: org.slug || "",
          createdAt: org.createdAt || null,
          updatedAt: org.updatedAt || null,
          owner: org.owner || null,
          memberCount: org.memberCount || 0,
        });

        setUserRole(data.userRole || "member");
        setCanEdit(data.canEdit !== undefined ? data.canEdit : false);
      } else {
        toast.error("Failed to load organization settings.");
      }
    } catch (error) {
      console.error("Error fetching organization settings:", error);
      const msg =
        error.response?.data?.message ||
        error.message ||
        "Failed to load organization settings.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgSettings();
  }, []);

  // Detect unsaved changes (isDirty)
  const isDirty =
    initialData && JSON.stringify(initialData) !== JSON.stringify(formData);

  // Real-time client-side field validation
  const validateField = (field, value) => {
    let newErrors = { ...errors };

    switch (field) {
      case "name":
        if (!value.trim()) {
          newErrors.name = "Organization name is required.";
        } else if (value.trim().length > 100) {
          newErrors.name = "Organization name cannot exceed 100 characters.";
        } else {
          delete newErrors.name;
        }
        break;

      case "description":
        if (value && value.length > 500) {
          newErrors.description =
            "Short description cannot exceed 500 characters.";
        } else {
          delete newErrors.description;
        }
        break;

      case "about":
        if (value && value.length > 2000) {
          newErrors.about = "About bio cannot exceed 2000 characters.";
        } else {
          delete newErrors.about;
        }
        break;

      case "contactEmail":
        if (value && value.trim()) {
          const emailPattern = /^[^\s@]+@[^\s@.]+\.[^\s@.]+$/;
          if (!emailPattern.test(value.trim())) {
            newErrors.contactEmail = "Please enter a valid email address.";
          } else {
            delete newErrors.contactEmail;
          }
        } else {
          delete newErrors.contactEmail;
        }
        break;

      case "website":
        if (value && value.trim()) {
          const urlPattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/.*)?$/i;
          if (!urlPattern.test(value.trim())) {
            newErrors.website =
              "Please enter a valid URL (e.g. https://example.com).";
          } else {
            delete newErrors.website;
          }
        } else {
          delete newErrors.website;
        }
        break;

      default:
        break;
    }

    setErrors(newErrors);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    validateField(name, value);
  };

  // Validate entire form before submission
  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Organization name is required.";
    } else if (formData.name.trim().length > 100) {
      newErrors.name = "Organization name cannot exceed 100 characters.";
    }

    if (formData.description && formData.description.length > 500) {
      newErrors.description = "Short description cannot exceed 500 characters.";
    }

    if (formData.about && formData.about.length > 2000) {
      newErrors.about = "About bio cannot exceed 2000 characters.";
    }

    if (formData.contactEmail && formData.contactEmail.trim()) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(formData.contactEmail.trim())) {
        newErrors.contactEmail = "Please enter a valid email address.";
      }
    }

    if (formData.website && formData.website.trim()) {
      const urlPattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/.*)?$/i;
      if (!urlPattern.test(formData.website.trim())) {
        newErrors.website =
          "Please enter a valid URL (e.g. https://example.com).";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle Save
  const handleSave = async (e) => {
    if (e) e.preventDefault();

    if (!canEdit) {
      toast.error("You do not have permission to edit organization settings.");
      return;
    }

    if (!validateForm()) {
      toast.error("Please fix validation errors before saving.");
      return;
    }

    try {
      setSaving(true);
      const { data } = await organizationApi.updateOrganizationSettings(
        metadata._id,
        formData,
      );

      if (data.success) {
        toast.success("Organization settings updated successfully!");
        setInitialData(formData);

        // Update user context if user's selected org name changed
        if (getUserData) {
          const updatedUser = await getUserData();
          if (updatedUser && setUserData) {
            setUserData(updatedUser);
            localStorage.setItem("userData", JSON.stringify(updatedUser));
          }
        }
      } else {
        toast.error(data.message || "Failed to update settings.");
      }
    } catch (error) {
      console.error("Error updating organization settings:", error);
      const msg =
        error.response?.data?.message ||
        error.message ||
        "Failed to update organization settings.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Reset/Discard changes
  const handleDiscard = () => {
    if (initialData) {
      setFormData(initialData);
      setErrors({});
      toast.info("Changes discarded.");
    }
  };

  // Copy Org ID to clipboard
  const handleCopyId = () => {
    if (metadata._id) {
      navigator.clipboard.writeText(metadata._id);
      setCopiedId(true);
      toast.success("Organization ID copied to clipboard!");
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  // Format date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getRoleBadgeStyle = (role) => {
    switch (role?.toLowerCase()) {
      case "owner":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-700";
      case "admin":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-700";
      default:
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-700";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col justify-center items-center p-6">
          <Loader2 className="animate-spin w-10 h-10 text-blue-600 dark:text-blue-400 mb-4" />
          <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">
            Loading Organization Settings...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-200 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
        {/* Breadcrumbs Navigation */}
        <nav className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
          >
            Dashboard
          </button>
          <ChevronRight className="w-3.5 h-3.5" />
          <button
            onClick={() => navigate("/organizations")}
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
          >
            Organization
          </button>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            Settings
          </span>
        </nav>

        {/* Header Title & Subtitle */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-blue-100 dark:bg-blue-900/40 rounded-xl text-blue-600 dark:text-blue-400">
                <Building2 className="w-6 h-6" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Organization Settings
              </h1>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Manage information, contact details, and administration settings
              for{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {formData.name || "your organization"}
              </span>
              .
            </p>
          </div>

          {/* Current User Role Badge */}
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border flex items-center gap-1.5 ${getRoleBadgeStyle(
                userRole,
              )}`}
            >
              <Shield className="w-3.5 h-3.5" />
              Role: {userRole}
            </span>
          </div>
        </div>

        {/* Read-Only Notice Banner for non-admin/owner */}
        {!canEdit && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3 text-amber-800 dark:text-amber-300">
            <Lock className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold">Read-Only Access</h4>
              <p className="text-xs mt-0.5 text-amber-700 dark:text-amber-400">
                You are viewing this organization in read-only mode. Only
                Organization Owners and Administrators have permissions to edit
                organization information.
              </p>
            </div>
          </div>
        )}

        {/* Unsaved Changes Sticky Banner */}
        {isDirty && canEdit && (
          <div className="sticky top-20 z-30 mb-6 p-4 rounded-xl bg-blue-600 text-white shadow-lg flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">
                You have unsaved changes to your organization information.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDiscard}
                disabled={saving}
                className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-1.5 bg-white text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Save Changes
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-8">
          {/* SECTION 1: GENERAL INFORMATION */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  General Information
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Basic details and description of your organization
                </p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Organization Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Organization Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  disabled={!canEdit || saving}
                  placeholder="e.g. Acme Corporation"
                  className={`w-full px-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border ${
                    errors.name
                      ? "border-red-500 dark:border-red-500 focus:ring-red-500"
                      : "border-slate-200 dark:border-slate-700 focus:ring-blue-500"
                  } text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed`}
                />
                {errors.name ? (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.name}
                  </p>
                ) : (
                  <div className="flex justify-end text-[11px] text-slate-400 mt-1">
                    {formData.name.length}/100
                  </div>
                )}
              </div>

              {/* Short Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Short Description
                </label>
                <input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  disabled={!canEdit || saving}
                  placeholder="Brief tagline or summary of the organization (e.g. Leading AI Research Team)"
                  className={`w-full px-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border ${
                    errors.description
                      ? "border-red-500 dark:border-red-500 focus:ring-red-500"
                      : "border-slate-200 dark:border-slate-700 focus:ring-blue-500"
                  } text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed`}
                />
                {errors.description ? (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.description}
                  </p>
                ) : (
                  <div className="flex justify-end text-[11px] text-slate-400 mt-1">
                    {formData.description.length}/500
                  </div>
                )}
              </div>

              {/* About / Bio */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  About / Bio
                </label>
                <textarea
                  name="about"
                  rows={4}
                  value={formData.about}
                  onChange={handleChange}
                  disabled={!canEdit || saving}
                  placeholder="Detailed information about the organization's mission, goals, background, or overview..."
                  className={`w-full px-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border ${
                    errors.about
                      ? "border-red-500 dark:border-red-500 focus:ring-red-500"
                      : "border-slate-200 dark:border-slate-700 focus:ring-blue-500"
                  } text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed resize-y`}
                />
                {errors.about ? (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.about}
                  </p>
                ) : (
                  <div className="flex justify-end text-[11px] text-slate-400 mt-1">
                    {formData.about.length}/2000
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 2: CONTACT & LOCATION DETAILS */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Contact Details & Metadata
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Website, email, industry, and location attributes
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Website */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  Website
                </label>
                <input
                  type="text"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  disabled={!canEdit || saving}
                  placeholder="https://example.com"
                  className={`w-full px-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border ${
                    errors.website
                      ? "border-red-500 focus:ring-red-500"
                      : "border-slate-200 dark:border-slate-700 focus:ring-blue-500"
                  } text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed`}
                />
                {errors.website && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.website}
                  </p>
                )}
              </div>

              {/* Contact Email */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  Contact Email
                </label>
                <input
                  type="email"
                  name="contactEmail"
                  value={formData.contactEmail}
                  onChange={handleChange}
                  disabled={!canEdit || saving}
                  placeholder="contact@organization.com"
                  className={`w-full px-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border ${
                    errors.contactEmail
                      ? "border-red-500 focus:ring-red-500"
                      : "border-slate-200 dark:border-slate-700 focus:ring-blue-500"
                  } text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed`}
                />
                {errors.contactEmail && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.contactEmail}
                  </p>
                )}
              </div>

              {/* Industry */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  Industry
                </label>
                <select
                  name="industry"
                  value={formData.industry}
                  onChange={handleChange}
                  disabled={!canEdit || saving}
                  className="w-full px-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-60 cursor-pointer"
                >
                  <option value="">Select Industry...</option>
                  {industryOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  Location
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  disabled={!canEdit || saving}
                  placeholder="City, Country (e.g. San Francisco, CA)"
                  className="w-full px-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: READ-ONLY SYSTEM METADATA */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-xl text-purple-600 dark:text-purple-400">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Organization Metadata
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Read-only system audit details and identifiers
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Organization ID */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Organization ID
                </p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-200 truncate mr-2">
                    {metadata._id || "N/A"}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                    title="Copy ID"
                  >
                    {copiedId ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Organization Slug */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Organization Slug
                </p>
                <p className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-200 mt-1.5 truncate">
                  {metadata.slug || "N/A"}
                </p>
              </div>

              {/* Created Date */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  Created Date
                </p>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-200 mt-1.5">
                  {formatDate(metadata.createdAt)}
                </p>
              </div>

              {/* Owner */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Organization Owner
                </p>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-200 mt-1.5 truncate">
                  {metadata.owner?.name
                    ? `${metadata.owner.name} (${metadata.owner.email})`
                    : "N/A"}
                </p>
              </div>

              {/* Member Count */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3 text-slate-400" />
                    Member Count
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate("/team-members")}
                    className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    Manage <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                </p>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-200 mt-1.5">
                  {metadata.memberCount} active member(s)
                </p>
              </div>

              {/* Last Updated */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Last Updated
                </p>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-200 mt-1.5">
                  {metadata.updatedAt ? formatDate(metadata.updatedAt) : "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Form Submit Bar (for Admin/Owner) */}
          {canEdit && (
            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={handleDiscard}
                disabled={!isDirty || saving}
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset Changes
              </button>
              <button
                type="submit"
                disabled={!isDirty || saving}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Settings
                  </>
                )}
              </button>
            </div>
          )}
        </form>
      </main>
    </div>
  );
};

export default OrganizationSettings;
