import React from "react";
import Navbar from "../components/Navbar.jsx";

const Summaries = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto text-center pt-28">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">🧠 AI Summarization</h1>
        <p className="text-gray-600 mb-6">
          Automatically generate detailed Minutes of Meeting and extract key insights.
        </p>

        <div className="bg-white p-8 rounded-2xl shadow-lg">
          <p className="text-gray-500">
            Coming soon: upload meeting transcripts and get auto-generated summaries, decisions, and highlights.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Summaries;
