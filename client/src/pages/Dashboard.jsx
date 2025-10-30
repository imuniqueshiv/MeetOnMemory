import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AppContent } from "../context/AppContext.jsx";
import {
  Building2,
  FileText,
  Upload,
  Search,
  Settings,
} from "lucide-react";
import Navbar from "../components/Navbar.jsx";

const Dashboard = () => {
  const { userData } = useContext(AppContent);
  const navigate = useNavigate();

  const organizationName =
    userData?.organization?.name?.toUpperCase() || "ORGANIZATION";

  // ---- Button Handlers ----
  const handleUpload = () => navigate("/upload-meeting");
  const handleCreateMeeting = () => navigate("/create-meeting");
  const handlePolicies = () => navigate("/policies");
  const handleSearchReports = () => navigate("/reports");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <Navbar />

      {/* Main Dashboard */}
      <div className="max-w-6xl mx-auto px-6 pt-28 pb-16 text-center">
        {/* Header Section */}
        <div className="flex flex-col items-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Building2 className="w-10 h-10 text-blue-700" />
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900">
              {organizationName}
            </h1>
          </div>
                  <p className="text-gray-600 text-sm sm:text-base mb-4">
                      Role:{" "}
                      <span className="font-semibold">
                          {userData?.role
                              ? userData.role.charAt(0).toUpperCase() + userData.role.slice(1)
                              : "Member"}
                      </span>
                  </p>


          {/* ✅ Search Bar */}
          <input
            type="text"
            placeholder="Search meetings, policies, or reports..."
            className="mt-2 w-full sm:w-96 px-5 py-2 border rounded-full shadow-sm focus:ring-2 focus:ring-blue-400 outline-none"
          />
        </div>

        {/* Action Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center mt-10">
          {/* Upload Meeting */}
          <FeatureCard
            icon={<Upload className="w-10 h-10 text-blue-600" />}
            title="Upload Recorded Meetings"
            description="Store and analyze past meetings automatically."
            onClick={handleUpload}
          />

          {/* Create Meeting */}
          <FeatureCard
            icon={<FileText className="w-10 h-10 text-green-600" />}
            title="Create New Meeting"
            description="Schedule, organize, and record new meetings."
            onClick={handleCreateMeeting}
          />

          {/* Summaries / Minutes */}
          <FeatureCard
            icon={<Settings className="w-10 h-10 text-purple-600" />}
            title="Meeting Summaries"
            description="View or edit automated summaries and decisions."
            onClick={() => navigate("/summaries")}
          />

          {/* Policy Repository */}
          <FeatureCard
            icon={<FileText className="w-10 h-10 text-yellow-600" />}
            title="Policies & Rules Repository"
            description="Maintain versioned digital records of policies."
            onClick={handlePolicies}
          />

          {/* Search Reports */}
          <FeatureCard
            icon={<Search className="w-10 h-10 text-pink-600" />}
            title="Search & Generate Reports"
            description="Find records and generate AI-powered reports."
            onClick={handleSearchReports}
          />
        </div>
      </div>
    </div>
  );
};

// ---- Reusable Card Component ----
const FeatureCard = ({ icon, title, description, onClick }) => (
  <div
    onClick={onClick}
    className="bg-white w-full max-w-xs rounded-2xl shadow-md hover:shadow-lg cursor-pointer border border-gray-100 transition-all duration-300 p-6 flex flex-col items-center text-center hover:-translate-y-1"
  >
    <div className="mb-4">{icon}</div>
    <h3 className="text-lg font-semibold mb-2">{title}</h3>
    <p className="text-sm text-gray-500">{description}</p>
  </div>
);

export default Dashboard;
