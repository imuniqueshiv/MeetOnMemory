import React from "react";
import Navbar from "../components/Navbar.jsx";

const Reports = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto text-center pt-28">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">📊 Reports & Analytics</h1>
        <p className="text-gray-600 mb-8">
          Visualize trends — number of meetings held, policies updated, and decisions made automatically.
        </p>

        <div className="bg-white rounded-2xl p-8 shadow-md">
          <p className="text-gray-500">
            Coming soon: interactive AI-powered analytics dashboard and report generator.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Reports;
