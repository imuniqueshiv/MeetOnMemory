// Policies Repository Page
import React from "react";
import Navbar from "../components/Navbar.jsx";

const Policies = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto text-center pt-28">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">📜 Policies & Rules Repository</h1>
        <p className="text-gray-600 mb-8">
          Maintain version-controlled institutional policies and governance documents.
        </p>

        <div className="bg-white p-6 rounded-2xl shadow-md">
          <p className="text-gray-500">
            Coming soon: upload policy documents, track revisions, and view change history.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Policies;
