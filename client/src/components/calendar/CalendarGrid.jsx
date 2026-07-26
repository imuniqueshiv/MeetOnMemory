import React from "react";
import { Clock, Briefcase } from "lucide-react";
import {
  isSameDay,
  getStatusStyle,
  formatTimeSlot,
  parseTimeToMinutes,
  getWeekDays,
  buildMonthGrid,
} from "./calendarUtils";

const CalendarGrid = ({
  view,
  currentDate,
  filteredMeetings,
  setSelectedMeeting,
}) => {
  return (
    <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
      {/* MONTH VIEW */}
      {view === "month" && (
        <div className="flex flex-col h-full min-w-[700px]">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider py-3 text-center">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 flex-1 min-h-[500px]">
            {buildMonthGrid(currentDate).map((cell, idx) => {
              const dayEvents = filteredMeetings.filter((m) =>
                isSameDay(new Date(m.date), cell.date),
              );
              const isToday = isSameDay(new Date(), cell.date);

              return (
                <div
                  key={idx}
                  className={`min-h-[100px] p-2 border-r border-b border-slate-100 dark:border-slate-800 last:border-r-0 flex flex-col justify-between transition-colors ${
                    cell.isCurrentMonth
                      ? "bg-white dark:bg-slate-900"
                      : "bg-slate-50/50 dark:bg-slate-800/50 text-slate-300 dark:text-slate-600"
                  }`}
                >
                  {/* Day Number */}
                  <div className="flex justify-between items-center mb-1">
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded-full flex items-center justify-center ${
                        isToday
                          ? "bg-blue-600 text-white shadow-xs"
                          : cell.isCurrentMonth
                            ? "text-slate-700 dark:text-slate-300"
                            : "text-slate-400 dark:text-slate-600"
                      }`}
                    >
                      {cell.date.getDate()}
                    </span>
                  </div>

                  {/* Events list */}
                  <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[85px] py-1">
                    {dayEvents.slice(0, 3).map((event) => {
                      const style = getStatusStyle(event.status);
                      return (
                        <button
                          key={event._id}
                          onClick={() => setSelectedMeeting(event)}
                          className={`w-full text-left p-1.5 rounded-lg border text-[10px] font-semibold truncate flex items-center gap-1.5 transition-all cursor-pointer select-none ${style.bg}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`}
                          />
                          <span className="truncate">{event.title}</span>
                        </button>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div className="text-[9px] font-bold text-blue-600 text-center py-0.5">
                        + {dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* WEEK VIEW */}
      {view === "week" && (
        <div className="flex flex-col h-full min-w-[800px]">
          {/* Week Headers */}
          <div className="grid grid-cols-8 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider py-3 text-center">
            <div className="border-r border-slate-100 dark:border-slate-700">
              Time
            </div>
            {getWeekDays(currentDate).map((day, idx) => {
              const isToday = isSameDay(new Date(), day);
              return (
                <div
                  key={idx}
                  className="flex flex-col items-center justify-center gap-0.5"
                >
                  <span>
                    {day.toLocaleDateString("en-US", {
                      weekday: "short",
                    })}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full flex items-center justify-center ${
                      isToday
                        ? "bg-blue-600 text-white font-bold"
                        : "text-slate-800"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Weekly Time Grid */}
          <div className="flex flex-col flex-1 h-[600px] overflow-y-auto">
            <div className="grid grid-cols-8 relative h-[650px]">
              {/* Y-Axis Hourly labels */}
              <div className="col-span-1 border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col justify-between py-2 text-[10px] text-slate-400 font-bold text-right pr-3">
                {Array.from({ length: 13 }).map((_, h) => (
                  <div
                    key={h}
                    className="h-[50px] flex items-start justify-end"
                  >
                    {h + 8 < 12
                      ? `${h + 8}:00 AM`
                      : h + 8 === 12
                        ? "12:00 PM"
                        : `${h + 8 - 12}:00 PM`}
                  </div>
                ))}
              </div>

              {/* Weekday columns mapping slots */}
              {getWeekDays(currentDate).map((day, dIdx) => {
                const dayEvents = filteredMeetings.filter((m) =>
                  isSameDay(new Date(m.date), day),
                );

                return (
                  <div
                    key={dIdx}
                    className="col-span-1 border-r border-slate-100 dark:border-slate-800 last:border-r-0 relative bg-white dark:bg-slate-900 h-full"
                  >
                    {/* Hour Dividers in background */}
                    {Array.from({ length: 13 }).map((_, h) => (
                      <div
                        key={h}
                        className="absolute left-0 right-0 border-b border-slate-50"
                        style={{ top: `${h * 50}px`, height: "50px" }}
                      />
                    ))}

                    {/* Placed Events */}
                    {dayEvents.map((event) => {
                      const style = getStatusStyle(event.status);
                      const minutesFromMidnight = parseTimeToMinutes(
                        event.time,
                      );

                      // Map to start hour (08:00 = 480 mins). Hour size = 50px (50px / 60 mins = 0.83px/min)
                      const startMins = 8 * 60;
                      const top = Math.max(
                        0,
                        (minutesFromMidnight - startMins) * (50 / 60),
                      );
                      const duration = event.duration || 60;
                      const height = Math.max(35, duration * (50 / 60));

                      return (
                        <button
                          key={event._id}
                          onClick={() => setSelectedMeeting(event)}
                          className={`absolute left-1 right-1 p-2 rounded-xl border text-[10px] font-bold text-left overflow-hidden flex flex-col justify-between transition-all shadow-xs hover:z-10 cursor-pointer select-none ${style.bg}`}
                          style={{
                            top: `${top}px`,
                            height: `${height}px`,
                          }}
                        >
                          <div className="truncate pr-1">{event.title}</div>
                          <div className="text-[8px] text-slate-500/80 font-semibold flex items-center gap-1 mt-0.5">
                            <Clock className="w-2.5 h-2.5 shrink-0" />
                            <span>{formatTimeSlot(event.time)}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* DAY VIEW */}
      {view === "day" && (
        <div className="flex flex-col h-full md:flex-row">
          {/* Left side Timeline Column */}
          <div className="flex-1 flex flex-col border-r border-slate-100 max-h-[600px] overflow-y-auto">
            <div className="bg-slate-50/50 dark:bg-slate-800/50 py-3 px-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Timeline
              </h3>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Hourly Schedule
              </span>
            </div>

            <div className="relative h-[650px] p-4 pr-6 flex">
              {/* Hourly scale */}
              <div className="w-20 text-[10px] text-slate-400 font-bold text-right pr-3 flex flex-col justify-between py-2 shrink-0">
                {Array.from({ length: 13 }).map((_, h) => (
                  <div
                    key={h}
                    className="h-[50px] flex items-start justify-end"
                  >
                    {h + 8 < 12
                      ? `${h + 8}:00 AM`
                      : h + 8 === 12
                        ? "12:00 PM"
                        : `${h + 8 - 12}:00 PM`}
                  </div>
                ))}
              </div>

              {/* Timeline grid content */}
              <div className="flex-1 relative border-l border-slate-100 pl-4 h-full">
                {/* Hour Grid Dividers */}
                {Array.from({ length: 13 }).map((_, h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-b border-slate-100/50"
                    style={{ top: `${h * 50}px`, height: "50px" }}
                  />
                ))}

                {/* Day events mapped */}
                {filteredMeetings
                  .filter((m) => isSameDay(new Date(m.date), currentDate))
                  .map((event) => {
                    const style = getStatusStyle(event.status);
                    const minutesFromMidnight = parseTimeToMinutes(event.time);

                    const startMins = 8 * 60;
                    const top = Math.max(
                      0,
                      (minutesFromMidnight - startMins) * (50 / 60),
                    );
                    const duration = event.duration || 60;
                    const height = Math.max(40, duration * (50 / 60));

                    return (
                      <button
                        key={event._id}
                        onClick={() => setSelectedMeeting(event)}
                        className={`absolute left-2 right-4 p-3 rounded-xl border text-left flex flex-col justify-between transition-all shadow-xs hover:z-10 cursor-pointer select-none ${style.bg}`}
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                        }}
                      >
                        <div className="font-bold text-xs truncate">
                          {event.title}
                        </div>
                        <div className="text-[10px] text-slate-500/80 font-bold flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            {formatTimeSlot(event.time)} ({duration} mins)
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Right side chronological list card */}
          <div className="w-full md:w-80 bg-slate-50/50 dark:bg-slate-800/50 p-5 flex flex-col h-full max-h-[600px] overflow-y-auto">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-4">
              List Agenda
            </h3>

            <div className="space-y-3.5">
              {filteredMeetings
                .filter((m) => isSameDay(new Date(m.date), currentDate))
                .sort(
                  (a, b) =>
                    parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time),
                )
                .map((event) => {
                  const style = getStatusStyle(event.status);
                  const StatusIcon = style.icon;

                  return (
                    <div
                      key={event._id}
                      onClick={() => setSelectedMeeting(event)}
                      className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 p-4 rounded-xl shadow-2xs hover:shadow-xs transition-all cursor-pointer flex items-start gap-3"
                    >
                      <div
                        className={`p-2 rounded-xl shrink-0 ${style.bg} border`}
                      >
                        <StatusIcon className="w-4 h-4" />
                      </div>
                      <div className="overflow-hidden space-y-1">
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">
                          {event.title}
                        </h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                          {formatTimeSlot(event.time)}
                        </p>
                        {event.organization && (
                          <p className="text-[10px] text-slate-500 font-medium truncate flex items-center gap-1">
                            <Briefcase className="w-3 h-3 text-slate-400" />
                            {event.organization.name || event.organization}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarGrid;
