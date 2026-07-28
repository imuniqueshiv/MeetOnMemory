import React from "react";

const RecurrenceSelector = ({
  scheduleData,
  handleScheduleChange,
  setScheduleData,
}) => {
  const isRecurring =
    scheduleData.recurrencePattern && scheduleData.recurrencePattern !== "none";

  const handleRecurrenceChange = (e) => {
    const value = e.target.value;
    setScheduleData((prev) => ({
      ...prev,
      recurrencePattern: value,
    }));
  };

  return (
    <div className="mb-6 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Recurrence
      </h3>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">
            Repeat
          </label>
          <select
            name="recurrencePattern"
            value={scheduleData.recurrencePattern || "none"}
            onChange={handleRecurrenceChange}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="none">Does not repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        {isRecurring && (
          <div>
            <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">
              End Date *
            </label>
            <input
              type="date"
              name="endDate"
              value={scheduleData.endDate || ""}
              onChange={handleScheduleChange}
              required={isRecurring}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
        )}
      </div>

      {isRecurring && scheduleData.recurrencePattern === "weekly" && (
        <div className="mt-4">
          <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">
            Day of Week (0=Sun, 6=Sat)
          </label>
          <input
            type="number"
            min="0"
            max="6"
            name="dayOfWeek"
            value={scheduleData.dayOfWeek || ""}
            onChange={handleScheduleChange}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
      )}

      {isRecurring && scheduleData.recurrencePattern === "monthly" && (
        <div className="mt-4">
          <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">
            Day of Month (1-31)
          </label>
          <input
            type="number"
            min="1"
            max="31"
            name="dayOfMonth"
            value={scheduleData.dayOfMonth || ""}
            onChange={handleScheduleChange}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
      )}
    </div>
  );
};

export default RecurrenceSelector;
