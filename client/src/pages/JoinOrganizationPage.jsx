// client/src/pages/JoinOrganizationPage.jsx
import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { AppContent } from "../context/AppContext.jsx";
import { toast } from "react-toastify";
import Navbar from "../components/Navbar.jsx";

const JoinOrganizationPage = () => {
  const { backendUrl, getUserData } = useContext(AppContent);
  const [orgList, setOrgList] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const { data } = await axios.get(`${backendUrl}/api/organizations`);
        if (data.success) setOrgList(data.organizations);
      } catch (err) {
        toast.error("Failed to load organizations");
      } finally {
        setLoading(false);
      }
    };
    fetchOrgs();
  }, []);

  const handleJoin = async (orgId) => {
    try {
      const { data } = await axios.post(`${backendUrl}/api/organizations/join`, {
        organizationId: orgId,
      });

      if (data.success) {
        toast.success("Joined organization successfully!");
        await getUserData();
        navigate("/dashboard");
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error("Failed to join organization");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <Navbar />
      <div className="flex-grow flex items-center justify-center">
        <div className="bg-white p-10 rounded-lg shadow-xl w-full max-w-lg text-center">
          <h1 className="text-3xl font-bold mb-6">Join an Organization</h1>
          {loading ? (
            <p>Loading organizations...</p>
          ) : orgList.length === 0 ? (
            <p>No organizations available yet.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {orgList.map((org) => (
                <button
                  key={org._id}
                  onClick={() => handleJoin(org._id)}
                  className="p-4 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-all"
                >
                  {org.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JoinOrganizationPage;
