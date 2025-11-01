// Upload Meeting Page
import React from "react";
import Navbar from "../components/Navbar.jsx";

const UploadMeeting = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-3xl mx-auto text-center pt-28">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">📤 Upload Recorded Meetings</h1>
        <p className="text-gray-600 mb-8">
          Upload your recorded sessions and let AI transcribe and summarize them automatically.
        </p>

        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
          <input
            type="file"
            accept="audio/*,video/*"
            className="block w-full mb-6 text-sm text-gray-700"
          />
          <button className="px-6 py-2 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition">
            Upload & Process
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadMeeting;
