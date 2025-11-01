import React from "react";
import Navbar from "../components/Navbar.jsx";

const CreateMeeting = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto text-center pt-28">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">📝 Create New Meeting</h1>
        <p className="text-gray-600 mb-6">
          Schedule, organize, and record meetings with real-time AI transcription and smart minutes generation.
        </p>

        <div className="bg-white shadow-md rounded-2xl p-8 text-left">
          <label className="block mb-3 font-medium text-gray-700">Meeting Title</label>
          <input
            type="text"
            placeholder="Enter meeting title"
            className="w-full px-4 py-2 border rounded-lg mb-4 focus:ring-2 focus:ring-blue-400 outline-none"
          />

          <label className="block mb-3 font-medium text-gray-700">Description</label>
          <textarea
            placeholder="Agenda, topics, or goals..."
            rows="4"
            className="w-full px-4 py-2 border rounded-lg mb-4 focus:ring-2 focus:ring-blue-400 outline-none"
          ></textarea>

          <button className="px-6 py-2 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition">
            Create Meeting
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateMeeting;
