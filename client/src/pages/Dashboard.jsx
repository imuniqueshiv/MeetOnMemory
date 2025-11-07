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
  Search,
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
  const handleAISearch = () => navigate("/ai-search");

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-blue-100 flex flex-col">
      {/* Navbar */}
      <Navbar />

      {/* Main Dashboard Container */}
      <div className="max-w-6xl mx-auto px-6 pt-28 pb-16 text-center">
        {/* Header Section */}
        <div className="flex flex-col items-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Building2 className="w-10 h-10 text-blue-700 drop-shadow-sm" />
            <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight">
              {organizationName}
            </h1>
          </div>

          <p className="text-gray-600 text-sm sm:text-base mb-6">
            Role:{" "}
            <span className="font-semibold text-gray-800">
              {userData?.role
                ? userData.role.charAt(0).toUpperCase() +
                  userData.role.slice(1).toLowerCase()
                : "Member"}
            </span>
          </p>

          {/* AI Search Section */}
          <div className="mt-4 flex flex-col items-center space-y-3 bg-white/70 backdrop-blur-md shadow-md border border-gray-100 rounded-2xl px-8 py-6 w-full sm:w-[28rem] hover:shadow-lg transition-all duration-300">
            <div className="flex items-center gap-2">
              <Search className="text-blue-600 w-6 h-6" />
              <h3 className="text-lg font-semibold text-gray-800">
                AI-Powered Smart Search
              </h3>
            </div>
            <p className="text-gray-500 text-sm mb-4">
              Instantly find insights across your meetings, summaries, and
              policies.
            </p>
            <button
              onClick={handleAISearch}
              className="px-8 py-2 bg-blue-600 text-white font-medium rounded-full shadow-sm hover:bg-blue-700 hover:shadow-md active:scale-95 transition-all duration-200"
            >
              🚀 Open AI Search
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px w-32 mx-auto bg-gray-300 my-10 opacity-60"></div>

        {/* Feature Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center mt-6">
          {/* Upload Meeting */}
          <FeatureCard
            icon={<Upload className="w-10 h-10 text-blue-600" />}
            title="Upload Recorded Meetings"
            description="Upload and transcribe past meetings automatically using AI-powered speech-to-text."
            onClick={handleUpload}
          />

          {/* Meeting Hub */}
          <FeatureCard
            icon={<FileText className="w-10 h-10 text-green-600" />}
            title="Meeting & Event Hub"
            description="Schedule, upload, and organize events or sessions for instant AI-driven summaries."
            onClick={handleCreateMeeting}
          />

          {/* AI Summaries */}
          <FeatureCard
            icon={<Brain className="w-10 h-10 text-purple-600" />}
            title="AI Summarization"
            description="Generate professional Minutes of Meeting with decisions and action points."
            onClick={() => navigate("/summaries")}
          />

          {/* Policy Management */}
          <FeatureCard
            icon={<Database className="w-10 h-10 text-yellow-600" />}
            title="Policies & Rules Repository"
            description="Upload, version, and audit organizational policies using AI insights."
            onClick={handlePolicies}
          />

          {/* Reports */}
          <FeatureCard
            icon={<BarChart3 className="w-10 h-10 text-indigo-600" />}
            title="Reports & Analytics"
            description="Visualize organizational metrics — meetings, updates, and performance trends."
            onClick={handleReports}
          />
        </div>

       
      </div>
    </div>
  );
};

// ---- Feature Card ----
const FeatureCard = ({ icon, title, description, onClick }) => (
  <div
    onClick={onClick}
    className="bg-white w-full max-w-xs rounded-2xl shadow-md hover:shadow-lg cursor-pointer border border-gray-100 transition-all duration-300 p-6 flex flex-col items-center text-center hover:-translate-y-1 hover:bg-blue-50/30"
  >
    <div className="mb-4 transition-transform duration-300 group-hover:scale-110">
      {icon}
    </div>
    <h3 className="text-lg font-semibold mb-2 text-gray-800">{title}</h3>
    <p className="text-sm text-gray-500">{description}</p>
  </div>
);

export default Dashboard;
