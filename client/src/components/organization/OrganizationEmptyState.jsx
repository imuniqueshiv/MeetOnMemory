import React from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Plus, Search } from "lucide-react";

const OrganizationEmptyState = () => {
  const navigate = useNavigate();

  return (
    <div className="flex-grow flex flex-col items-center justify-center py-12 sm:py-24 px-4 text-center">
      {/* Empty State Icon */}
      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 flex items-center justify-center mb-6 shadow-sm">
        <Building2 className="w-10 h-10 sm:w-12 sm:h-12 text-blue-600 dark:text-blue-400" />
      </div>

      {/* Empty State Text */}
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
        No Organizations Yet
      </h2>
      <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 max-w-md mb-8">
        You haven't joined any organizations. Create a new organization or
        browse existing ones to get started.
      </p>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row w-full max-w-xs sm:max-w-none mx-auto justify-center gap-3 sm:gap-4">
        <button
          onClick={() => navigate("/create-organization")}
          className="flex items-center justify-center w-full sm:w-auto gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
        >
          <Plus className="w-5 h-5" />
          Create Organization
        </button>

        <button
          onClick={() => navigate("/browse-organizations")}
          className="flex items-center justify-center w-full sm:w-auto gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl font-semibold transition-all border border-gray-200 dark:border-gray-700"
        >
          <Search className="w-5 h-5" />
          Browse Organizations
        </button>
      </div>
    </div>
  );
};

export default OrganizationEmptyState;
