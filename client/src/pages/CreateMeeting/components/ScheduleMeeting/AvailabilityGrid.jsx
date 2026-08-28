import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Link,
  Loader2,
  RefreshCw,
  Sparkles,
  User,
  Users,
  XCircle,
} from "lucide-react";
import { calendarAvailabilityApi } from "../../../../api/calendarAvailabilityApi.js";

const SLOT_START_HOUR = 8;
const SLOT_END_HOUR = 18;
const SLOT_MINUTES = 30;

const toParticipantList = (participants) =>
  (Array.isArray(participants) ? participants : []).filter(Boolean);

const getParticipantLabel = (participant) =>
  participant?.name ||
  participant?.user?.name ||
  participant?.email ||
  "Participant";

const getParticipantEmail = (participant) =>
  participant?.email || participant?.user?.email || "";

const normalizeBusyEntries = (calendar) =>
  Array.isArray(calendar?.busy) ? calendar.busy : [];

const overlaps = (slotStart, slotEnd, busyStart, busyEnd) =>
  slotStart < busyEnd && slotEnd > busyStart;

const formatParticipantNames = (participants) => {
  const names = [...new Set(participants.map(getParticipantLabel))];
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} +${names.length - 3} more`;
};

const AvailabilityGrid = ({ participants, selectedDate, onSlotSelect }) => {
  const participantList = useMemo(
    () => toParticipantList(participants),
    [participants],
  );

  const [loading, setLoading] = useState(false);
  const [connectionLoading, setConnectionLoading] = useState(true);
  const [availabilityData, setAvailabilityData] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [error, setError] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [connectingProvider, setConnectingProvider] = useState(null);

  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Local time",
    [],
  );

  const timeSlots = useMemo(() => {
    const slots = [];
    for (
      let minutes = SLOT_START_HOUR * 60;
      minutes <= SLOT_END_HOUR * 60;
      minutes += SLOT_MINUTES
    ) {
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      slots.push(
        `${hour.toString().padStart(2, "0")}:${minute
          .toString()
          .padStart(2, "0")}`,
      );
    }
    return slots;
  }, []);

  const connectedProviders = useMemo(() => {
    const integrations = Array.isArray(connectionStatus?.integrations)
      ? connectionStatus.integrations
      : [];

    return new Set(
      integrations
        .filter(
          (integration) =>
            integration?.syncStatus === "connected" ||
            integration?.syncEnabled === true,
        )
        .map((integration) =>
          integration.provider === "outlook"
            ? "microsoft"
            : integration.provider,
        ),
    );
  }, [connectionStatus]);

  const hasConnectedCalendar = connectedProviders.size > 0;

  const fetchConnectionStatus = useCallback(async () => {
    setConnectionLoading(true);
    try {
      const data = await calendarAvailabilityApi.getConnectionStatus();
      setConnectionStatus(data);
    } catch (statusError) {
      // Free/busy can still be attempted if the status endpoint is temporarily
      // unavailable. Keep this as a non-blocking warning.
      console.warn(
        "Unable to load calendar connection status:",
        statusError?.message || statusError,
      );
      setConnectionStatus(null);
    } finally {
      setConnectionLoading(false);
    }
  }, []);

  const fetchAvailability = useCallback(async () => {
    if (!selectedDate || participantList.length === 0) return;

    const attendeeEmails = participantList
      .map(getParticipantEmail)
      .map((email) => email.trim())
      .filter(Boolean);

    if (attendeeEmails.length === 0) {
      setAvailabilityData(null);
      setError(
        "Your participants do not have email addresses, so calendar availability cannot be checked.",
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const timeMin = new Date(selectedDate);
      timeMin.setHours(SLOT_START_HOUR, 0, 0, 0);

      const timeMax = new Date(selectedDate);
      timeMax.setHours(SLOT_END_HOUR, 0, 0, 0);

      const response = await calendarAvailabilityApi.getFreeBusy({
        attendeeEmails,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
      });

      if (!response?.success) {
        throw new Error(
          response?.message || "Calendar availability could not be loaded.",
        );
      }

      setAvailabilityData(response.data || { google: {}, microsoft: {} });
    } catch (availabilityError) {
      console.error("Error fetching availability:", availabilityError);
      setAvailabilityData(null);
      setError(
        availabilityError?.response?.data?.message ||
          availabilityError?.message ||
          "Calendar availability could not be loaded. Try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [participantList, selectedDate]);

  useEffect(() => {
    fetchConnectionStatus();
  }, [fetchConnectionStatus]);

  useEffect(() => {
    setSelectedSlot(null);

    if (selectedDate && participantList.length > 0) {
      fetchAvailability();
    } else {
      setAvailabilityData(null);
      setError(null);
    }
  }, [selectedDate, participantList.length, fetchAvailability]);

  const getSlotDetails = useCallback(
    (timeSlot) => {
      if (!selectedDate) {
        return { availability: "unknown", conflicts: [] };
      }

      const [hours, minutes] = timeSlot.split(":").map(Number);
      const slotStart = new Date(selectedDate);
      slotStart.setHours(hours, minutes, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + SLOT_MINUTES * 60000);

      const conflicts = new Map();
      const participantByEmail = new Map(
        participantList
          .map((participant) => [
            getParticipantEmail(participant).toLowerCase(),
            participant,
          ])
          .filter(([email]) => email),
      );

      const addConflict = (identifier) => {
        const normalized = String(identifier || "").toLowerCase();
        const participant = participantByEmail.get(normalized);
        const label = participant
          ? getParticipantLabel(participant)
          : String(identifier || "Calendar participant");
        conflicts.set(normalized || label, label);
      };

      let hasAvailabilitySource = false;

      Object.entries(availabilityData?.google || {}).forEach(
        ([email, calendar]) => {
          hasAvailabilitySource = true;
          normalizeBusyEntries(calendar).forEach((busy) => {
            const busyStart = new Date(busy.start);
            const busyEnd = new Date(busy.end);
            if (overlaps(slotStart, slotEnd, busyStart, busyEnd)) {
              addConflict(email);
            }
          });
        },
      );

      const microsoftSchedules = Array.isArray(availabilityData?.microsoft)
        ? availabilityData.microsoft
        : [];

      microsoftSchedules.forEach((schedule) => {
        hasAvailabilitySource = true;
        const scheduleEmail = schedule?.scheduleId || "";
        normalizeBusyEntries(schedule).forEach((busy) => {
          const busyStart = new Date(busy.start);
          const busyEnd = new Date(busy.end);
          if (overlaps(slotStart, slotEnd, busyStart, busyEnd)) {
            addConflict(scheduleEmail);
          }
        });
      });

      if (!availabilityData) {
        return { availability: "unknown", conflicts: [] };
      }

      return {
        availability:
          !hasAvailabilitySource && !hasConnectedCalendar
            ? "unknown"
            : conflicts.size > 0
              ? "busy"
              : hasAvailabilitySource
                ? "available"
                : "unknown",
        conflicts: [...conflicts.values()],
      };
    },
    [availabilityData, hasConnectedCalendar, participantList, selectedDate],
  );

  const handleSlotClick = (timeSlot) => {
    const details = getSlotDetails(timeSlot);
    if (details.availability === "busy" || details.availability === "unknown") {
      return;
    }

    setSelectedSlot(timeSlot);
    onSlotSelect?.(timeSlot);
  };

  const handleSuggestSlot = () => {
    const firstAvailable = timeSlots.find(
      (slot) => getSlotDetails(slot).availability === "available",
    );

    if (firstAvailable) {
      setSelectedSlot(firstAvailable);
      onSlotSelect?.(firstAvailable);
    }
  };

  const handleConnect = async (provider) => {
    setConnectingProvider(provider);
    setError(null);

    try {
      const response = await calendarAvailabilityApi.getConnectUrl(provider);
      if (!response?.authUrl) {
        throw new Error("Calendar connection URL was not returned.");
      }
      window.location.assign(response.authUrl);
    } catch (connectError) {
      console.error("Error starting calendar connection:", connectError);
      setError(
        connectError?.response?.data?.message ||
          connectError?.message ||
          "Unable to start calendar connection.",
      );
      setConnectingProvider(null);
    }
  };

  const renderConnectionCta = () => (
    <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-950/30">
      <div className="flex items-start gap-3">
        <Link className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
            Connect a calendar to see real conflicts
          </p>
          <p className="mt-1 text-xs text-indigo-700 dark:text-indigo-300">
            Free/busy data is only available when Google Calendar or Microsoft
            Calendar is connected to your MeetOnMemory account.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {["google", "microsoft"].map((provider) => (
              <button
                key={provider}
                type="button"
                onClick={() => handleConnect(provider)}
                disabled={connectingProvider !== null}
                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {connectingProvider === provider ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Link className="h-3.5 w-3.5" />
                )}
                Connect {provider === "google" ? "Google" : "Microsoft"}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (!selectedDate) {
    return (
      <div className="rounded-xl bg-slate-50 p-6 dark:bg-slate-800">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <Calendar className="h-5 w-5" />
          <p className="text-sm">Select a date to view availability</p>
        </div>
      </div>
    );
  }

  if (participantList.length === 0) {
    return (
      <div className="rounded-xl bg-slate-50 p-6 dark:bg-slate-800">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <User className="h-5 w-5" />
          <p className="text-sm">Add participants to view their availability</p>
        </div>
      </div>
    );
  }

  const showDisconnectedCta =
    !connectionLoading && !hasConnectedCalendar && !loading;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-400" />
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Scheduling Assistant
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {new Date(selectedDate).toLocaleDateString()} · {timeZone}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSuggestSlot}
            disabled={loading || !availabilityData}
            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 transition-colors hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Suggest Slot
          </button>
          <button
            type="button"
            onClick={() => {
              fetchConnectionStatus();
              fetchAvailability();
            }}
            disabled={loading || connectionLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            title="Refresh calendar availability"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {participantList.length} participant
          {participantList.length === 1 ? "" : "s"}
        </span>
        <span>Calendar times shown in {timeZone}</span>
        {hasConnectedCalendar && (
          <span className="font-medium text-emerald-700 dark:text-emerald-400">
            Calendar connected
          </span>
        )}
      </div>

      {showDisconnectedCta && renderConnectionCta()}

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-32 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            Checking participant calendars…
          </div>
        </div>
      ) : !availabilityData ? (
        <div className="flex min-h-32 flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-4 text-center dark:border-slate-800 dark:bg-slate-800/50">
          <AlertCircle className="mb-2 h-5 w-5 text-slate-400" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Availability is unavailable
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Refresh the grid or connect a calendar to continue.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {timeSlots.map((timeSlot) => {
              const details = getSlotDetails(timeSlot);
              const isSelected = selectedSlot === timeSlot;
              const isBusy = details.availability === "busy";
              const isUnknown = details.availability === "unknown";

              return (
                <button
                  key={timeSlot}
                  type="button"
                  onClick={() => handleSlotClick(timeSlot)}
                  disabled={isBusy || isUnknown || loading}
                  title={
                    isBusy
                      ? `Busy: ${formatParticipantNames(details.conflicts)}`
                      : isUnknown
                        ? "Availability could not be verified"
                        : `Available at ${timeSlot}`
                  }
                  className={`relative cursor-pointer rounded-lg border-2 p-3 transition-all ${
                    isBusy
                      ? "cursor-not-allowed border-red-300 bg-red-100 opacity-70 dark:border-red-700 dark:bg-red-900/30"
                      : isUnknown
                        ? "cursor-not-allowed border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-800"
                        : "border-green-300 bg-green-100 hover:bg-green-200 dark:border-green-700 dark:bg-green-900/30 dark:hover:bg-green-900/50"
                  } ${
                    isSelected
                      ? "ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900"
                      : ""
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-200">
                      {timeSlot}
                    </span>
                    {isBusy ? (
                      <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    ) : isUnknown ? (
                      <AlertCircle className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    )}
                    {isBusy && details.conflicts.length > 0 && (
                      <span className="max-w-full truncate text-[10px] font-medium text-red-700 dark:text-red-300">
                        {details.conflicts.length} conflict
                        {details.conflicts.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-xs dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded border border-green-300 bg-green-100 dark:border-green-700 dark:bg-green-900/30" />
              <span className="text-slate-600 dark:text-slate-400">Free</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded border border-red-300 bg-red-100 dark:border-red-700 dark:bg-red-900/30" />
              <span className="text-slate-600 dark:text-slate-400">
                Busy / conflict
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded border border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-800" />
              <span className="text-slate-600 dark:text-slate-400">
                Unknown
              </span>
            </div>
          </div>

          {Object.keys(availabilityData.google || {}).length === 0 &&
            (!Array.isArray(availabilityData.microsoft) ||
              availabilityData.microsoft.length === 0) &&
            hasConnectedCalendar && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Your connected calendar did not return participant busy
                  intervals for this range. Verify participant calendar
                  permissions before relying on these slots.
                </span>
              </div>
            )}
        </>
      )}
    </div>
  );
};

export default AvailabilityGrid;
