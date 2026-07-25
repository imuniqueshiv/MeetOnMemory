const MeetingInformationForm = ({
  scheduleData,
  setScheduleData,
  handleScheduleChange,
}) => {
  return (
    <>
      {/* Meeting Type */}
      <div className="mb-6">
        <label className="block mb-3 font-semibold text-gray-700">
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
              className={`px-4 py-2 rounded-lg border-2 transition capitalize ${
                scheduleData.meetingType === type
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Title & Description */}
      <div className="mb-6">
        <label className="block mb-2 font-semibold text-gray-700">
          Meeting Title *
        </label>
        <input
          type="text"
          name="title"
          value={scheduleData.title}
          onChange={handleScheduleChange}
          placeholder="e.g., Q4 Board Meeting, Policy Review"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
          required
        />
      </div>

      <div className="mb-6">
        <label className="block mb-2 font-semibold text-gray-700">
          Description & Objective
        </label>
        <textarea
          name="description"
          value={scheduleData.description}
          onChange={handleScheduleChange}
          placeholder="Brief overview and expected outcomes..."
          rows="3"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
        ></textarea>
      </div>

      {/* Date & Time */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block mb-2 font-semibold text-gray-700">
            Date *
          </label>
          <input
            type="date"
            name="date"
            value={scheduleData.date}
            onChange={handleScheduleChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
            required
          />
        </div>
        <div>
          <label className="block mb-2 font-semibold text-gray-700">
            Time *
          </label>
          <input
            type="time"
            name="time"
            value={scheduleData.time}
            onChange={handleScheduleChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
            required
          />
        </div>
        <div>
          <label className="block mb-2 font-semibold text-gray-700">
            Duration (min)
          </label>
          <input
            type="number"
            name="duration"
            value={scheduleData.duration}
            onChange={handleScheduleChange}
            placeholder="60"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
          />
        </div>
      </div>

    {/* Location */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block mb-2 font-semibold text-gray-700">
            Location/Platform
          </label>
          <input
            type="text"
            name="location"
            value={scheduleData.location}
            onChange={handleScheduleChange}
            placeholder="e.g., Zoom, Conference Room A"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
          />
        </div>
        <div>
          <label className="block mb-2 font-semibold text-gray-700">
            Venue Details
          </label>
          <input
            type="text"
            name="venue"
            value={scheduleData.venue}
            onChange={handleScheduleChange}
            placeholder="Address or meeting link"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
          />
        </div>
      </div>

      {/* Sync to Calendar */}
      <div className="mb-6 flex items-center gap-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
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
          className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
        />
        <label
          htmlFor="syncToCalendar"
          className="text-sm font-medium text-slate-800 cursor-pointer"
        >
          Sync to my connected calendars (Google/Outlook)
        </label>
      </div>
    </>
  );
};

export default MeetingInformationForm;
