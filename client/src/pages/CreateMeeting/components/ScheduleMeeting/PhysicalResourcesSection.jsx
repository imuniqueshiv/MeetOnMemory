import React, { useEffect, useState } from "react";
import { Building2, Info } from "lucide-react";
import useResourceBookings from "../../../../hooks/useResourceBookings";
import { buildScheduleSlot } from "../../utils/scheduleConflicts";

const PhysicalResourcesSection = ({
  scheduleData,
  userData,
  selectedResources,
  setSelectedResources,
}) => {
  const { fetchAvailableResources } = useResourceBookings();
  const [availableResources, setAvailableResources] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!scheduleData.date || !scheduleData.time || !scheduleData.duration) {
      if (typeof setAvailableResources === "function")
        setAvailableResources([]);
      if (typeof setSelectedResources === "function") setSelectedResources([]);
      return;
    }

    const orgId = userData?.organization?._id || userData?.organization;
    if (!orgId) return;

    const slot = buildScheduleSlot(
      scheduleData.date,
      scheduleData.time,
      scheduleData.duration,
    );
    if (!slot) return;

    const loadResources = async () => {
      setLoading(true);
      try {
        const resources = await fetchAvailableResources(
          orgId,
          slot.start,
          slot.end,
        );
        if (!cancelled) {
          setAvailableResources(resources);
          // Auto deselect resources that are no longer available
          const availableIds = resources.map((r) => r._id);
          setSelectedResources((prev) =>
            prev.filter((id) => availableIds.includes(id)),
          );
        }
      } catch (err) {
        console.error("Failed to fetch available resources", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadResources();

    return () => {
      cancelled = true;
    };
  }, [
    scheduleData.date,
    scheduleData.time,
    scheduleData.duration,
    userData,
    fetchAvailableResources,
    setSelectedResources,
  ]);

  const toggleResource = (resourceId) => {
    setSelectedResources((prev) =>
      prev.includes(resourceId)
        ? prev.filter((id) => id !== resourceId)
        : [...prev, resourceId],
    );
  };

  return (
    <div className="mb-6 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50">
      <div className="flex items-center gap-2 mb-2">
        <Building2 className="text-slate-600 dark:text-slate-400" size={18} />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200">
          Physical Resources
        </h3>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        Book physical rooms, equipment, or catering for this timeslot.
      </p>

      {!scheduleData.date || !scheduleData.time || !scheduleData.duration ? (
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 rounded-lg">
          <Info className="text-amber-500 mt-0.5 flex-shrink-0" size={16} />
          <p className="text-xs text-amber-700 dark:text-amber-400 mb-0">
            Please set a date, time, and duration above to check resource
            availability.
          </p>
        </div>
      ) : loading ? (
        <div className="text-xs text-slate-500 py-2">
          Checking availability...
        </div>
      ) : availableResources.length === 0 ? (
        <div className="text-xs text-slate-500 py-2">
          No physical resources available for this timeslot.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3">
          {availableResources.map((resource) => (
            <label
              key={resource._id}
              className={`flex items-start p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedResources.includes(resource._id)
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-slate-200 dark:border-slate-700 hover:border-blue-300"
              }`}
            >
              <input
                type="checkbox"
                className="mt-1 mr-3 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={selectedResources.includes(resource._id)}
                onChange={() => toggleResource(resource._id)}
              />
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-200 leading-tight">
                  {resource.name}
                </div>
                <div className="text-xs text-slate-500 mt-1 capitalize">
                  {resource.type}{" "}
                  {resource.capacity > 0 && `• Cap: ${resource.capacity}`}
                </div>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

export default PhysicalResourcesSection;
