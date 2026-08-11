import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import AppContent from "../context/AppContent";
import Navbar from "../components/Navbar.jsx";
import MeetingRepository from "../components/meetings/MeetingRepository.jsx";
import RoleGate from "../components/RoleGate.jsx";
import { PlusCircle, Calendar, Trash2 } from "lucide-react";

const MeetingListPage = () => {
  const { userData } = useContext(AppContent);
  const navigate = useNavigate();

  const handleCreateMeeting = () => {
    navigate("/create-meeting");
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-200 pt-8">
      {/* Navbar */}
      <Navbar />

      {/* Page Header */}
      <header className="text-center mt-16 mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
          Welcome,{" "}
          <span className="text-blue-600 dark:text-blue-400">
            {userData ? userData.name : "User"}
          </span>
          !
        </h1>
        <p className="text-gray-500 dark:text-slate-400 mt-2 text-base">
          Browse, search, and manage all your uploaded meetings
        </p>
      </header>

      {/* Main Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        {/* Top Actions */}
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
            <Calendar className="w-5 h-5 text-blue-500" />
            Meeting Repository
          </h2>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/meetings/recycle-bin")}
              className="flex items-center gap-2 border border-gray-300 dark:border-gray-700 px-4 py-2.5 rounded-full"
            >
              <Trash2 className="w-5 h-5" />
              Recycle Bin
            </button>
            <RoleGate resource="meetings" action="create">
              <button
                onClick={handleCreateMeeting}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-full transition-all duration-200 cursor-pointer"
              >
                <PlusCircle className="w-5 h-5" />
                Create New Meeting
              </button>
            </RoleGate>
          </div>
        </div>

        {/* Meeting Repository Component */}
        <MeetingRepository />
      </div>
    </div>
  );
};

export default MeetingListPage;
