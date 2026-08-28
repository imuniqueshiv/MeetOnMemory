import React, { useContext, useEffect, useState } from "react";
import { organizationApi } from "../services";
import { toast } from "react-toastify";
import Navbar from "../components/Navbar";
import OrganizationHeader from "../components/organization/OrganizationHeader";
import OrganizationGrid from "../components/organization/OrganizationGrid";
import OrganizationEmptyState from "../components/organization/OrganizationEmptyState";
import TopContributorsWidget from "../components/organization/TopContributorsWidget";
import ParkingLotBacklog from "../components/organization/ParkingLotBacklog";
import AppContent from "../context/AppContent";
import { Building2 } from "lucide-react";

// Organization Hub page for managing user organizations
const OrganizationHub = () => {
  const { userData } = useContext(AppContent) || {};
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchUserOrganizations = async () => {
    try {
      setLoading(true);
      const { data } = await organizationApi.getUserOrganizations();
      if (data.success) {
        const orgList = data.organizations || [];
        setOrganizations(orgList);
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

  // Determine active organization ID from userData or list fallback
  useEffect(() => {
    const userOrgId =
      typeof userData?.organization === "object"
        ? userData?.organization?._id
        : userData?.organization;

    if (userOrgId && organizations.some((org) => org._id === userOrgId)) {
      setSelectedOrgId(userOrgId);
    } else if (organizations.length > 0) {
      // If current selectedOrgId is not valid or empty, fallback to first org
      setSelectedOrgId((prev) =>
        prev && organizations.some((org) => org._id === prev)
          ? prev
          : organizations[0]._id,
      );
    } else {
      setSelectedOrgId("");
    }
  }, [userData, organizations]);

  const activeOrg = organizations.find((o) => o._id === selectedOrgId);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="flex-grow flex flex-col container mx-auto px-4 pt-24 pb-12 sm:pt-28 sm:pb-16">
        <OrganizationHeader showActions={organizations.length > 0} />

        {loading ? (
          <OrganizationGrid organizations={[]} loading={true} />
        ) : organizations.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Your Organizations
              </h2>
              <OrganizationGrid organizations={organizations} loading={false} />
            </div>
            <div className="lg:col-span-1">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Engagement
                </h2>
                {organizations.length > 1 && (
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <select
                      aria-label="Select organization for engagement metrics"
                      value={selectedOrgId}
                      onChange={(e) => setSelectedOrgId(e.target.value)}
                      className="text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {organizations.map((org) => (
                        <option key={org._id} value={org._id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              {activeOrg && organizations.length === 1 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 -mt-2">
                  Showing metrics for{" "}
                  <span className="font-medium">{activeOrg.name}</span>
                </p>
              )}
              <div className="sticky top-24 flex flex-col gap-6">
                <TopContributorsWidget organizationId={selectedOrgId} />
                <ParkingLotBacklog organizationId={selectedOrgId} />
              </div>
            </div>
          </div>
        ) : (
          <OrganizationEmptyState />
        )}
      </div>
    </div>
  );
};

export default OrganizationHub;
