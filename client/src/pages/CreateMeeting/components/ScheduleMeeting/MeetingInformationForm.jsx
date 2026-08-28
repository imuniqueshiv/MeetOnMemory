import React from "react";
import RecurrenceSelector from "../../../../components/meetings/RecurrenceSelector";
import VenueMapPreview from "../../../../components/meetings/VenueMapPreview";
import TagAutocomplete from "../../../../components/meetings/TagAutocomplete.jsx";

const MeetingInformationForm = ({
  scheduleData,
  setScheduleData,
  handleScheduleChange,
}) => {
  return (
    <>
      {/* Meeting Type */}
      <div className="mb-6">
        <label className="block mb-3 font-semibold text-gray-700 dark:text-gray-300">
          Meeting Type
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {["conference", "policy", "event", "internal"].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() =>
                setScheduleData({ ...scheduleData, meetingType: type })
              }
              className={`px-4 py-2 rounded-lg border-2 transition capitalize cursor-pointer ${
                scheduleData.meetingType === type
                  ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Title & Description */}
      <div className="mb-6">
        <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">
          Meeting Title *
        </label>
        <input
          type="text"
          name="title"
          value={scheduleData.title}
          onChange={handleScheduleChange}
          placeholder="e.g., Q4 Board Meeting, Policy Review"
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          required
        />
      </div>

      <div className="mb-6">
        <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">
          Description & Objective
        </label>
        <textarea
          name="description"
          value={scheduleData.description}
          onChange={handleScheduleChange}
          placeholder="Brief overview and expected outcomes..."
          rows="3"
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
        ></textarea>
      </div>

      {/* Meeting Tags */}
      <div className="mb-6">
        <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">
          Meeting Tags
        </label>
        <TagAutocomplete
          selectedTags={scheduleData.tags || []}
          setSelectedTags={(tags) =>
            setScheduleData((prev) => ({
              ...prev,
              tags: typeof tags === "function" ? tags(prev.tags || []) : tags,
            }))
          }
        />
      </div>

      {/* Date & Time */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">
            Date *
          </label>
          <input
            type="date"
            name="date"
            value={scheduleData.date}
            onChange={handleScheduleChange}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            required
          />
        </div>
        <div>
          <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">
            Time *
          </label>
          <input
            type="time"
            name="time"
            value={scheduleData.time}
            onChange={handleScheduleChange}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            required
          />
        </div>
        <div>
          <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">
            Duration (min)
          </label>
          <input
            type="number"
            name="duration"
            value={scheduleData.duration}
            onChange={handleScheduleChange}
            placeholder="60"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
      </div>

      {/* Location */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">
            Location/Platform
          </label>
          <input
            type="text"
            name="location"
            value={scheduleData.location}
            onChange={handleScheduleChange}
            placeholder="e.g., Zoom, Conference Room A"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
        <div>
          <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">
            Venue Details
          </label>
          <input
            type="text"
            name="venue"
            value={scheduleData.venue}
            onChange={handleScheduleChange}
            placeholder="Address or meeting link"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
      </div>

      {/* Venue Map Preview for physical venues or virtual links */}
      {scheduleData.venue && (
        <div className="mb-6">
          <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300 text-sm">
            Venue Preview
          </label>
          <VenueMapPreview
            venue={scheduleData.venue}
            coordinates={scheduleData.venueCoordinates}
            onCoordinatesResolved={(coords) => {
              setScheduleData((prev) => ({
                ...prev,
                venueCoordinates: coords,
              }));
            }}
          />
        </div>
      )}

      {/* Recurrence Selector */}
      <RecurrenceSelector
        scheduleData={scheduleData}
        handleScheduleChange={handleScheduleChange}
        setScheduleData={setScheduleData}
      />

      {/* Sync to Calendar */}
      <div className="mb-6 flex items-center gap-3 bg-blue-50/50 dark:bg-blue-950/30 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50">
        <input
          type="checkbox"
          id="syncToCalendar"
          name="syncToCalendar"
          checked={scheduleData.syncToCalendar !== false}
          onChange={(e) =>
            setScheduleData({
              ...scheduleData,
              syncToCalendar: e.target.checked,
            })
          }
          className="w-5 h-5 text-blue-600 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-blue-500"
        />
        <label
          htmlFor="syncToCalendar"
          className="text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer"
        >
          Sync to my connected calendars (Google/Outlook)
        </label>
      </div>
    </>
  );
};

export default MeetingInformationForm;
