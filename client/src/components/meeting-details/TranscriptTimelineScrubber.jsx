import React, { useEffect, useMemo, useRef, useState } from "react";
import { meetingTimelineApi } from "../../services/meetingTimelineApi";
import { useTimelineSync } from "../../hooks/useTimelineSync";
import TimelinePlayer from "./TimelinePlayer";

const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return "00:00";
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
};

/**
 * Resolve playable media path from meeting and/or transcript records.
 */
const resolveTranscriptMediaPath = (meeting, transcript) =>
  meeting?.audioFilePath ||
  meeting?.fileUrl ||
  transcript?.audioFilePath ||
  null;

/**
 * Speaker / event scrubber synced with TimelinePlayer for TranscriptViewer (#2252).
 */
const TranscriptTimelineScrubber = ({
  meetingId,
  meeting,
  transcript,
  onCurrentTimeChange,
  seekRef,
}) => {
  const timelineRef = useRef(null);
  const [timelineEvents, setTimelineEvents] = useState([]);
  const {
    currentTime,
    duration,
    isPlaying,
    playerRef,
    seekTo,
    togglePlayPause,
    handleTimeUpdate,
    handleDurationChange,
    setIsPlaying,
  } = useTimelineSync();

  const mediaPath = resolveTranscriptMediaPath(meeting, transcript);
  const mediaMeeting = useMemo(
    () => ({
      ...(meeting || {}),
      audioFilePath: mediaPath,
    }),
    [meeting, mediaPath],
  );

  const segments = transcript?.segments || [];

  useEffect(() => {
    onCurrentTimeChange?.(currentTime);
  }, [currentTime, onCurrentTimeChange]);

  useEffect(() => {
    if (seekRef) {
      seekRef.current = seekTo;
    }
    return () => {
      if (seekRef) seekRef.current = null;
    };
  }, [seekRef, seekTo]);

  useEffect(() => {
    if (!meetingId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await meetingTimelineApi.getMeetingTimeline(meetingId);
        if (!cancelled && data?.success) {
          setTimelineEvents(data.timeline || []);
        }
      } catch (err) {
        console.error("Failed to load meeting timeline for scrubber:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [meetingId]);

  const maxSegmentTime = segments.reduce(
    (max, seg) => Math.max(max, seg.endTime || seg.startTime || 0),
    0,
  );
  const maxEventTime = timelineEvents.reduce(
    (max, ev) => Math.max(max, ev.endTime || ev.startTime || 0),
    0,
  );
  const totalDuration =
    duration || transcript?.duration || maxSegmentTime || maxEventTime || 1;

  const handleTimelineClick = (e) => {
    if (!mediaPath || !timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    seekTo(percentage * totalDuration);
  };

  if (!mediaPath) {
    return (
      <div
        className="mb-6 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-slate-800/50 p-4 text-center text-sm text-gray-500 dark:text-gray-400"
        data-testid="transcript-scrubber-empty"
      >
        No audio or video available to scrub. Segment review still works without
        media playback.
      </div>
    );
  }

  return (
    <div
      className="mb-6 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-4"
      data-testid="transcript-timeline-scrubber"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Speaker Timeline
        </h3>
        <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </span>
      </div>

      <div
        ref={timelineRef}
        className="relative h-10 bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden cursor-pointer border border-gray-200 dark:border-gray-700"
        onClick={handleTimelineClick}
        role="slider"
        aria-label="Seek transcript media"
        aria-valuemin={0}
        aria-valuemax={Math.floor(totalDuration)}
        aria-valuenow={Math.floor(currentTime)}
      >
        <div
          className="absolute top-0 bottom-0 left-0 bg-indigo-100 dark:bg-indigo-900/40 border-r border-indigo-400"
          style={{
            width: `${Math.min(100, (currentTime / totalDuration) * 100)}%`,
          }}
        />

        {segments.map((segment, index) => {
          const start = segment.startTime || 0;
          const end = segment.endTime ?? start;
          const leftPercent = (start / totalDuration) * 100;
          const widthPercent = Math.max(
            0.4,
            ((end - start) / totalDuration) * 100,
          );
          const isActive =
            currentTime >= start && currentTime < (end || start + 0.25);
          return (
            <button
              key={`seg-${index}`}
              type="button"
              title={`${segment.speaker || "Speaker"} @ ${formatTime(start)}`}
              className={`absolute top-1/2 -translate-y-1/2 h-3 rounded-full transition-all ${
                isActive
                  ? "bg-indigo-600 h-5 z-10"
                  : "bg-blue-400/80 hover:bg-blue-500 hover:h-4"
              }`}
              style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
                minWidth: "4px",
              }}
              onClick={(e) => {
                e.stopPropagation();
                seekTo(start);
              }}
            />
          );
        })}

        {timelineEvents
          .filter((ev) => ev.type === "key_moment")
          .map((event, index) => {
            const leftPercent = (event.startTime / totalDuration) * 100;
            return (
              <button
                key={`km-${index}`}
                type="button"
                title={event.data?.snippet || "Key moment"}
                className="absolute top-0 bottom-0 w-0.5 bg-purple-500 z-20 hover:w-1"
                style={{ left: `${leftPercent}%` }}
                onClick={(e) => {
                  e.stopPropagation();
                  seekTo(event.startTime);
                }}
              />
            );
          })}
      </div>

      <TimelinePlayer
        meeting={mediaMeeting}
        playerRef={playerRef}
        isPlaying={isPlaying}
        togglePlayPause={togglePlayPause}
        handleTimeUpdate={handleTimeUpdate}
        handleDurationChange={handleDurationChange}
        setIsPlaying={setIsPlaying}
      />
    </div>
  );
};

export default TranscriptTimelineScrubber;
