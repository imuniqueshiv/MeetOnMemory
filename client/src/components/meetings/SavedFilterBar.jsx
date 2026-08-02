import React, { useState, useEffect } from "react";
import { Filter, PinOff, Users } from "lucide-react";
import savedFilterApi from "../../services/savedFilterApi";
import { toast } from "react-toastify";

const SavedFilterBar = ({ onApplyFilter }) => {
  const [pinnedFilters, setPinnedFilters] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchFilters = async () => {
    try {
      const response = await savedFilterApi.getSavedFilters();
      if (response.data?.success) {
        setPinnedFilters(response.data.savedFilters.filter((f) => f.isPinned));
      }
    } catch (error) {
      console.error("Error fetching saved filters:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilters();
  }, []);

  const handleTogglePin = async (e, id) => {
    e.stopPropagation();
    try {
      await savedFilterApi.togglePinSavedFilter(id);
      fetchFilters(); // refresh list
    } catch {
      toast.error("Failed to unpin filter");
    }
  };

  if (loading || pinnedFilters.length === 0) {
    return null; // Don't render anything if loading or empty
  }

  return (
    <div className="mb-6 flex flex-wrap gap-3 items-center">
      <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
        <Filter className="w-4 h-4" />
        Saved Views:
      </span>
      {pinnedFilters.map((filter) => (
        <button
          key={filter._id}
          onClick={() => onApplyFilter(filter.filters)}
          className="group relative flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200"
        >
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: filter.color || "#3b82f6" }}
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {filter.name}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
              {filter.matchCount || 0}
            </span>
            {filter.isShared && (
              <Users
                className="w-3 h-3 text-gray-400"
                title="Shared with Organization"
              />
            )}
            <button
              onClick={(e) => handleTogglePin(e, filter._id)}
              className="ml-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Unpin"
            >
              <PinOff className="w-3 h-3" />
            </button>
          </div>
        </button>
      ))}
    </div>
  );
};

export default SavedFilterBar;
