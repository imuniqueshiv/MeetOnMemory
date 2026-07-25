import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Calendar, Clock, User, Loader2, CheckCircle2, XCircle } from "lucide-react";

const AvailabilityGrid = ({ participants, selectedDate, onSlotSelect }) => {
  const [loading, setLoading] = useState(false);
  const [availabilityData, setAvailabilityData] = useState(null);
  const [timeSlots, setTimeSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Generate time slots (8 AM to 6 PM, 30-minute intervals)
  useEffect(() => {
    const slots = [];
    for (let hour = 8; hour <= 18; hour++) {
      slots.push(`${hour.toString().padStart(2, "0")}:00`);
      slots.push(`${hour.toString().padStart(2, "0")}:30`);
    }
    setTimeSlots(slots);
  }, []);

  const fetchAvailability = useCallback(async () => {
    if (!selectedDate || participants.length === 0) return;

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const attendeeEmails = participants.map((p) => p.email).filter(Boolean);
      
      if (attendeeEmails.length === 0) {
        setAvailabilityData(null);
        setLoading(false);
        return;
      }

      // Set time range for the selected date (8 AM to 6 PM)
      const timeMin = new Date(selectedDate);
      timeMin.setHours(8, 0, 0, 0);
      
      const timeMax = new Date(selectedDate);
      timeMax.setHours(18, 0, 0, 0);

      const response = await axios.post(
        "/api/calendar/freebusy",
        {
          attendeeEmails,
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setAvailabilityData(response.data.data);
    } catch (error) {
      console.error("Error fetching availability:", error);
      // Don't show error for missing calendar connections - just show as unknown
      setAvailabilityData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, participants]);

  // Fetch availability when date or participants change
  useEffect(() => {
    if (selectedDate && participants.length > 0) {
      fetchAvailability();
    }
  }, [selectedDate, participants, fetchAvailability]);

  const getSlotAvailability = (timeSlot) => {
    if (!availabilityData) return "unknown";
    
    const [hours, minutes] = timeSlot.split(":");
    const slotStart = new Date(selectedDate);
    slotStart.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    const slotEnd = new Date(slotStart.getTime() + 30 * 60000);

    // Check Google availability
    let googleAvailable = true;
    if (availabilityData.google) {
      Object.values(availabilityData.google).forEach((calendar) => {
        if (calendar.busy) {
          calendar.busy.forEach((busy) => {
            const busyStart = new Date(busy.start);
            const busyEnd = new Date(busy.end);
            if (slotStart < busyEnd && slotEnd > busyStart) {
              googleAvailable = false;
            }
          });
        }
      });
    }

    // Check Microsoft availability
    let microsoftAvailable = true;
    if (availabilityData.microsoft && Array.isArray(availabilityData.microsoft)) {
      availabilityData.microsoft.forEach((schedule) => {
        if (schedule.availabilityView) {
          const slotIndex = Math.floor((slotStart.getHours() - 8) * 2 + (slotStart.getMinutes() / 30));
          if (schedule.availabilityView[slotIndex] === '1') {
            microsoftAvailable = false;
          }
        }
      });
    }

    // If no data from either provider, return unknown
    if (!availabilityData.google && !availabilityData.microsoft) {
      return "unknown";
    }

    // Return available if both providers agree (or only one has data)
    if (availabilityData.google && availabilityData.microsoft) {
      return googleAvailable && microsoftAvailable ? "available" : "busy";
    }
    return googleAvailable || microsoftAvailable ? "available" : "busy";
  };

  const handleSlotClick = (timeSlot) => {
    const availability = getSlotAvailability(timeSlot);
    if (availability === "available") {
      setSelectedSlot(timeSlot);
      onSlotSelect(timeSlot);
    }
  };

  const getSlotColor = (availability) => {
    switch (availability) {
      case "available":
        return "bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 border-green-300 dark:border-green-700";
      case "busy":
        return "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 opacity-50 cursor-not-allowed";
      case "unknown":
      default:
        return "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-600";
    }
  };

  const getSlotIcon = (availability) => {
    switch (availability) {
      case "available":
        return <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />;
      case "busy":
        return <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />;
      case "unknown":
      default:
        return null;
    }
  };

  if (!selectedDate) {
    return (
      <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <Calendar className="w-5 h-5" />
          <p className="text-sm">Select a date to view availability</p>
        </div>
      </div>
    );
  }

  if (participants.length === 0) {
    return (
      <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <User className="w-5 h-5" />
          <p className="text-sm">Add participants to view their availability</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Scheduling Assistant
          </h3>
        </div>
        {loading && <Loader2 className="w-5 h-5 animate-spin text-blue-600" />}
      </div>

      <div className="mb-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Showing availability for {participants.length} participant(s) on{" "}
          {new Date(selectedDate).toLocaleDateString()}
        </p>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {timeSlots.map((timeSlot) => {
          const availability = getSlotAvailability(timeSlot);
          const isSelected = selectedSlot === timeSlot;
          
          return (
            <button
              key={timeSlot}
              onClick={() => handleSlotClick(timeSlot)}
              disabled={availability === "busy" || loading}
              className={`
                relative p-3 rounded-lg border-2 transition-all
                ${getSlotColor(availability)}
                ${isSelected ? "ring-2 ring-blue-500 ring-offset-2" : ""}
              `}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-200">
                  {timeSlot}
                </span>
                {getSlotIcon(availability)}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700" />
          <span className="text-slate-600 dark:text-slate-400">Available</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700" />
          <span className="text-slate-600 dark:text-slate-400">Busy</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600" />
          <span className="text-slate-600 dark:text-slate-400">Unknown</span>
        </div>
      </div>
    </div>
  );
};

export default AvailabilityGrid;
