// client/src/pages/CreateOrganizationPage.jsx
import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AppContent } from "/src/context/AppContext.jsx";
import axios from "axios";
import { toast } from "react-toastify";
import Navbar from "/src/components/Navbar.jsx";

const CreateOrganizationPage = () => {
  const navigate = useNavigate();
  const { backendUrl, getUserData } = useContext(AppContent);
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!orgName.trim()) return toast.error("Organization name is required.");

    try {
      setLoading(true);
      axios.defaults.withCredentials = true;

      const { data } = await axios.post(
        `${backendUrl}/api/organizations/create-or-join`,
        { name: orgName.trim(), role: "admin" }
      );

      if (data.success) {
        toast.success(data.message);
        await getUserData();
        navigate("/dashboard");
      } else {
        toast.error(data.message || "Something went wrong");
      }
    } catch (error) {
      console.error("Organization error:", error);
      toast.error(error.response?.data?.message || "Server error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100">
      <Navbar />
      <div className="grow flex items-center justify-center w-full px-4">
        <div className="bg-white p-10 rounded-lg shadow-xl text-center w-full max-w-md">
          <h1 className="text-3xl font-bold mb-6">Create or Join Organization</h1>
          <p className="text-gray-600 mb-8">
            Enter your organization name. If it exists, you’ll be linked to it.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Enter your organization name"
              className="w-full px-4 py-3 border rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full p-3 bg-blue-600 text-white rounded-lg text-lg font-semibold hover:bg-blue-700 transition-all"
            >
              {loading ? "Processing..." : "Create / Join"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateOrganizationPage;
