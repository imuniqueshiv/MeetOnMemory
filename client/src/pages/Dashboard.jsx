import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AppContent } from "../context/AppContext.jsx";
import {
  Building2,
  FileText,
  Upload,
  BarChart3,
  Brain,
  Database,
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
  const handleReports = () => navigate("/reports");

  // ✅ NEW: Navigate to AI Search Page
  const handleAISearch = () => navigate("/ai-search");

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
                ? userData.role.charAt(0).toUpperCase() +
                  userData.role.slice(1).toLowerCase()
                : "Member"}
            </span>
          </p>

          {/* 🔍 AI-Powered Search Section */}
          <div className="mt-6 flex flex-col items-center space-y-3">
            <h3 className="text-lg font-semibold text-gray-800">
              🤖 AI-Powered Search
            </h3>
            <p className="text-gray-500 text-sm">
              Ask anything about your meetings, policies, or decisions.
            </p>

            <div className="flex items-center w-full sm:w-[28rem] bg-white shadow-md rounded-full border border-gray-300 overflow-hidden">
              <input
                type="text"
                placeholder="e.g. What decisions were made in last month’s meetings?"
                className="flex-grow px-5 py-2 text-sm text-gray-700 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAISearch();
                }}
              />
              <button
                onClick={handleAISearch}
                className="bg-blue-600 text-white px-5 py-2 font-medium text-sm rounded-r-full hover:bg-blue-700 transition-all duration-200"
              >
                AI Search
              </button>
            </div>
          </div>
        </div>

        {/* Action Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center mt-10">
          {/* Upload Meeting */}
          <FeatureCard
            icon={<Upload className="w-10 h-10 text-blue-600" />}
            title="Upload Recorded Meetings"
            description="Store, transcribe, and analyze past meetings automatically with AI speech-to-text."
            onClick={handleUpload}
          />

          {/* Create Meeting */}
          <FeatureCard
            icon={<FileText className="w-10 h-10 text-green-600" />}
            title="Create New Meeting"
            description="Schedule, organize, and record new meetings with real-time AI transcription."
            onClick={handleCreateMeeting}
          />

          {/* AI Summaries */}
          <FeatureCard
            icon={<Brain className="w-10 h-10 text-purple-600" />}
            title="AI Summarization"
            description="Automatically generate Minutes of Meeting and highlight key action points."
            onClick={() => navigate("/summaries")}
          />

          {/* Policies & Version Control */}
          <FeatureCard
            icon={<Database className="w-10 h-10 text-yellow-600" />}
            title="Policies & Rules Repository"
            description="Maintain version-controlled digital records for policies and governance documents."
            onClick={handlePolicies}
          />

          {/* Reports & Analytics */}
          <FeatureCard
            icon={<BarChart3 className="w-10 h-10 text-indigo-600" />}
            title="Reports & Analytics"
            description="Visualize trends — meetings held, policies updated, and decisions made automatically."
            onClick={handleReports}
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
    <h3 className="text-lg font-semibold mb-2 text-gray-800">{title}</h3>
    <p className="text-sm text-gray-500">{description}</p>
  </div>
);

export default Dashboard;
