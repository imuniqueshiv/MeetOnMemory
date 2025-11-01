import React from "react";
import Navbar from "../components/Navbar.jsx";

const AiSearch = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto text-center pt-28">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">🤖 AI-Powered Search</h1>
        <p className="text-gray-600 mb-6">
          Ask anything about your meetings, policies, or decisions — powered by semantic AI search.
        </p>

        <div className="bg-white p-8 rounded-2xl shadow-lg">
          <input
            type="text"
            placeholder="e.g. Find meeting where attendance policy was discussed"
            className="w-full px-5 py-3 border rounded-full shadow-sm focus:ring-2 focus:ring-blue-400 outline-none mb-4"
          />
          <button className="px-6 py-2 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition">
            Search
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiSearch;
