import React, { useContext, useEffect, useState } from "react";
import { organizationApi } from "../services";
import { toast } from "react-toastify";
import Navbar from "../components/Navbar";
import OrganizationHeader from "../components/organization/OrganizationHeader";
import OrganizationGrid from "../components/organization/OrganizationGrid";
import OrganizationEmptyState from "../components/organization/OrganizationEmptyState";
import Leaderboard from "../components/organization/Leaderboard.jsx";
import AppContent from "../context/AppContent";

// Organization Hub page for managing user organizations
const OrganizationHub = () => {
  const { userData } = useContext(AppContent);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUserOrganizations = async () => {
    try {
      setLoading(true);
      const { data } = await organizationApi.getUserOrganizations();
      if (data.success) {
        setOrganizations(data.organizations || []);
      }
    } catch (error) {
      console.error("Failed to fetch organizations:", error);
      toast.error("Failed to load organizations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserOrganizations();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="flex-grow flex flex-col container mx-auto px-4 pt-24 pb-12 sm:pt-28 sm:pb-16">
        <OrganizationHeader showActions={organizations.length > 0} />

        {loading ? (
          <OrganizationGrid organizations={[]} loading={true} />
        ) : organizations.length > 0 ? (
          <>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Your Organizations
            </h2>
            <OrganizationGrid organizations={organizations} loading={false} />
            <div className="mt-8">
              <Leaderboard organizationId={userData?.organization?._id} />
            </div>
          </>
        ) : (
          <OrganizationEmptyState />
        )}
      </div>
    </div>
  );
};

export default OrganizationHub;
