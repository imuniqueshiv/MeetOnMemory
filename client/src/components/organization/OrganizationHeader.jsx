import React from "react";
import { Building2, Plus, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

const OrganizationHeader = ({ showActions = true }) => {
  const navigate = useNavigate();

  return (
    <div
      className={`flex flex-col ${
        showActions
          ? "sm:flex-row justify-between items-center"
          : "items-center justify-center text-center"
      } gap-5 mb-8`}
    >
      <div
        className={`flex flex-col items-center ${
          showActions ? "sm:items-start text-center sm:text-left" : "text-center"
        } w-full sm:w-auto`}
      >
        <h1
          className={`text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center justify-center ${
            showActions ? "sm:justify-start" : ""
          } gap-3`}
        >
          <Building2 className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400" />
          Organization Hub
        </h1>
        <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">
          Manage your organizations and discover new ones
        </p>
      </div>

      {showActions && (
        <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-3 mt-2 sm:mt-0">
          <button
            onClick={() => navigate("/create-organization")}
            className="flex items-center justify-center w-full sm:w-auto gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="w-5 h-5" />
            <span>Create Organization</span>
          </button>

          <button
            onClick={() => navigate("/join-organization")}
            className="flex items-center justify-center w-full sm:w-auto gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl font-semibold transition-all border border-gray-200 dark:border-gray-700"
          >
            <Search className="w-5 h-5" />
            <span>Browse</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default OrganizationHeader;
