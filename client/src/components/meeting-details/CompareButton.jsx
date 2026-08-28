import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getComparableMeetings } from "../../services/comparisonApi";

const CompareButton = ({ meetingId }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [comparableMeetings, setComparableMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleClick = () => {
    setIsOpen(!isOpen);
  };

  const fetchComparableMeetings = async () => {
    setLoading(true);
    try {
      const meetings = await getComparableMeetings(meetingId);
      setComparableMeetings(meetings);
    } catch (error) {
      console.error("Failed to fetch comparable meetings", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && comparableMeetings.length === 0 && !loading) {
      fetchComparableMeetings();
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCompare = (otherMeetingId) => {
    setIsOpen(false);
    navigate(
      `/meetings/compare?meetingA=${meetingId}&meetingB=${otherMeetingId}`,
    );
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={handleClick}
        className="inline-flex justify-center items-center px-4 py-2 text-sm font-medium text-white bg-transparent border border-white/30 hover:bg-white/10 rounded-md shadow-sm transition-colors"
      >
        <svg
          className="w-4 h-4 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          ></path>
        </svg>
        {t("meetingComparison.compare")}
      </button>

      {isOpen && (
        <div className="origin-top-right absolute right-0 mt-2 w-72 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50 overflow-hidden">
          <div className="py-2">
            <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              {t("meetingComparison.compareWith")}
            </div>

            <div className="max-h-60 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center items-center py-4 text-gray-500">
                  <svg
                    className="animate-spin h-5 w-5 mr-3 text-blue-600"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  {t("meetingComparison.loading")}
                </div>
              ) : comparableMeetings.length > 0 ? (
                comparableMeetings.map((meeting) => (
                  <button
                    key={meeting._id}
                    onClick={() => handleCompare(meeting._id)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {meeting.title}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {new Date(meeting.date).toLocaleDateString()}
                    </div>
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center italic">
                  {t("meetingComparison.noComparable")}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompareButton;
