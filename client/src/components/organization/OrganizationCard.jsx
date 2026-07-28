import React from "react";
import { useNavigate } from "react-router-dom";
import { Users, Clock, Shield } from "lucide-react";
import { organizationApi } from "../../services";
import { toast } from "react-toastify";
import AppContent from "../../context/AppContent";
import OrganizationLogo from "./OrganizationLogo.jsx";

const OrganizationCard = ({ organization }) => {
  const navigate = useNavigate();
  const { getUserData, setUserData, userData } = React.useContext(AppContent);

  if (!organization) return null;

  const {
    _id,
    name,
    description = "",
    logo = null,
    role = "member",
    memberCount = 0,
    lastActive = null,
  } = organization;

  const getRoleBadgeColor = (role) => {
    switch (role?.toLowerCase()) {
      case "admin":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
      case "owner":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
      default:
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
    }
  };

  const formatLastActive = (date) => {
    if (!date) return "No activity";
    const now = new Date();
    const activityDate = new Date(date);
    const diffMs = now - activityDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return activityDate.toLocaleDateString();
  };

  const handleCardClick = async () => {
    try {
      // If user already has this org selected, just navigate
      if (userData?.organization?._id === _id) {
        navigate("/dashboard");
        return;
      }

      // Otherwise, select the organization first
      const { data } = await organizationApi.selectOrganization({
        organizationId: _id,
      });

      if (data.success) {
        const updatedUser = await getUserData();
        if (updatedUser) {
          setUserData(updatedUser);
          localStorage.setItem("userData", JSON.stringify(updatedUser));
        }
        toast.success(`Switched to ${name}`);
        navigate("/dashboard");
      } else {
        toast.error(data.message || "Failed to select organization");
      }
    } catch (error) {
      console.error("Failed to select organization:", error);
      toast.error("Failed to select organization");
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className="group relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300 cursor-pointer"
    >
      {/* Organization Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <OrganizationLogo
            src={logo || organization.logoUrl || ""}
            name={name}
            size="lg"
            className="shadow-lg"
          />
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {name}
            </h3>
            {description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Role Badge */}
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${getRoleBadgeColor(
            role,
          )}`}
        >
          <Shield className="w-3 h-3" />
          {role?.charAt(0)?.toUpperCase() + role?.slice(1) || "Member"}
        </span>
      </div>

      {/* Organization Stats */}
      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1.5">
          <Users className="w-4 h-4" />
          <span>{memberCount || 0} members</span>
        </div>
        {lastActive && (
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            <span>{formatLastActive(lastActive)}</span>
          </div>
        )}
      </div>

      {/* Hover Effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    </div>
  );
};

export default OrganizationCard;
