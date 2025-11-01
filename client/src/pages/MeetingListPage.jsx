import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AppContent } from "../context/AppContext.jsx";
import Navbar from "../components/Navbar.jsx";
import { PlusCircle, Calendar, Video, ClipboardList } from "lucide-react";

const MeetingListPage = () => {
  const { userData } = useContext(AppContent);
  const navigate = useNavigate();

  const handleCreateMeeting = () => {
    navigate("/create-meeting");
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* ✅ Navbar */}
      <Navbar />

      {/* ✅ Page Header */}
      <header className="text-center mt-16 mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold">
          Welcome,{" "}
          <span className="text-blue-600">
            {userData ? userData.name : "User"}
          </span>
          !
        </h1>
        <p className="text-gray-500 mt-2 text-base">
          Here are your upcoming and past meetings.
        </p>
      </header>

      {/* ✅ Main Section */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Top Actions */}
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            Your Meetings
          </h2>

          <button
            onClick={handleCreateMeeting}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-full transition-all duration-200"
          >
            <PlusCircle className="w-5 h-5" />
            Create New Meeting
          </button>
        </div>

        {/* ✅ Meetings List */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Placeholder cards (replace with actual meeting data later) */}
          <div className="bg-white rounded-2xl p-5 shadow hover:shadow-md transition-all">
            <div className="flex items-center gap-3 mb-3">
              <Video className="w-6 h-6 text-blue-500" />
              <h3 className="font-semibold text-lg">AI Strategy Discussion</h3>
            </div>
            <p className="text-gray-500 text-sm">
              Recorded on Oct 28, 2025 • Duration: 45 min
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow hover:shadow-md transition-all">
            <div className="flex items-center gap-3 mb-3">
              <ClipboardList className="w-6 h-6 text-purple-500" />
              <h3 className="font-semibold text-lg">Team Review Meeting</h3>
            </div>
            <p className="text-gray-500 text-sm">
              Recorded on Oct 25, 2025 • Duration: 1 hr
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow hover:shadow-md transition-all">
            <div className="flex items-center gap-3 mb-3">
              <Video className="w-6 h-6 text-green-500" />
              <h3 className="font-semibold text-lg">Faculty Roundtable</h3>
            </div>
            <p className="text-gray-500 text-sm">
              Recorded on Oct 20, 2025 • Duration: 30 min
            </p>
          </div>
        </div>

        {/* ✅ Empty State (optional) */}
        {/* Uncomment this when dynamic meetings are integrated */}
        {/* {meetings.length === 0 && (
          <p className="text-center text-gray-500 mt-12">
            You have no meetings scheduled. Click “Create New Meeting” to start one!
          </p>
        )} */}
      </main>
    </div>
  );
};

export default MeetingListPage;
