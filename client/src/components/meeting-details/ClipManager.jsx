import React, { useState, useEffect, useCallback } from "react";
import meetingClipApi from "../../services/meetingClipApi";

const ClipManager = ({ meetingId }) => {
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create clip state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  // Annotation state
  const [annotationText, setAnnotationText] = useState("");
  const [annotationTimestamp, setAnnotationTimestamp] = useState("");
  const [activeClipId, setActiveClipId] = useState(null);

  const fetchClips = useCallback(async () => {
    try {
      setLoading(true);
      const data = await meetingClipApi.getMeetingClips(meetingId);
      setClips(data);
    } catch (err) {
      setError("Failed to load clips");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    fetchClips();
  }, [fetchClips]);

  const handleCreateClip = async (e) => {
    e.preventDefault();
    if (!title || startTime === "" || endTime === "") return;

    try {
      const newClip = await meetingClipApi.createClip({
        meetingId,
        title,
        description,
        startTime: Number(startTime),
        endTime: Number(endTime),
      });
      setClips([newClip, ...clips]);
      setTitle("");
      setDescription("");
      setStartTime("");
      setEndTime("");
    } catch (err) {
      setError("Failed to create clip");
      console.error(err);
    }
  };

  const handleDeleteClip = async (clipId) => {
    if (!window.confirm("Are you sure you want to delete this clip?")) return;
    try {
      await meetingClipApi.deleteClip(clipId);
      setClips(clips.filter((c) => c._id !== clipId));
    } catch (err) {
      setError("Failed to delete clip");
      console.error(err);
    }
  };

  const handleAddAnnotation = async (e, clipId) => {
    e.preventDefault();
    if (!annotationText || annotationTimestamp === "") return;

    try {
      const newAnnotation = await meetingClipApi.addClipAnnotation(clipId, {
        text: annotationText,
        timestamp: Number(annotationTimestamp),
      });

      setClips(
        clips.map((c) => {
          if (c._id === clipId) {
            return { ...c, annotations: [...c.annotations, newAnnotation] };
          }
          return c;
        }),
      );
      setAnnotationText("");
      setAnnotationTimestamp("");
    } catch (err) {
      setError("Failed to add annotation");
      console.error(err);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  if (loading) return <div className="p-4 text-center">Loading clips...</div>;

  return (
    <div className="p-4 bg-white rounded shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Meeting Clips</h2>
      {error && <div className="text-red-500 mb-4">{error}</div>}

      <div className="mb-8 border-b pb-6">
        <h3 className="text-lg font-medium mb-3">Create New Clip</h3>
        <form onSubmit={handleCreateClip} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 border"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 border"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Start Time (seconds)
              </label>
              <input
                type="number"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 border"
                min="0"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                End Time (seconds)
              </label>
              <input
                type="number"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 block w-full rounded border-gray-300 shadow-sm p-2 border"
                min="0"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Create Clip
          </button>
        </form>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-3">
          Saved Clips ({clips.length})
        </h3>
        {clips.length === 0 ? (
          <p className="text-gray-500 italic">
            No clips have been created for this meeting.
          </p>
        ) : (
          <div className="space-y-6">
            {clips.map((clip) => (
              <div key={clip._id} className="border rounded p-4 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="text-lg font-bold">{clip.title}</h4>
                    <p className="text-sm text-gray-600">{clip.description}</p>
                    <p className="text-xs text-blue-600 font-semibold mt-1">
                      {formatTime(clip.startTime)} - {formatTime(clip.endTime)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteClip(clip._id)}
                    className="text-red-500 text-sm hover:underline"
                  >
                    Delete
                  </button>
                </div>

                {/* Transcript Segments */}
                <div className="mt-4 bg-gray-50 p-3 rounded">
                  <h5 className="text-sm font-semibold mb-2 text-gray-700">
                    Transcript Segments
                  </h5>
                  {clip.transcriptSegments?.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {clip.transcriptSegments.map((seg, idx) => (
                        <div key={idx} className="text-sm">
                          <span className="font-semibold text-gray-800">
                            {seg.speaker}:{" "}
                          </span>
                          <span className="text-gray-700">{seg.text}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic">
                      No transcript segments in this range.
                    </p>
                  )}
                </div>

                {/* Annotations */}
                <div className="mt-4">
                  <h5 className="text-sm font-semibold mb-2 text-gray-700">
                    Annotations
                  </h5>
                  {clip.annotations?.length > 0 && (
                    <ul className="mb-3 space-y-1">
                      {clip.annotations.map((ann, idx) => (
                        <li
                          key={idx}
                          className="text-sm bg-blue-50 p-2 rounded flex justify-between"
                        >
                          <span>{ann.text}</span>
                          <span className="text-gray-500 text-xs">
                            @ {formatTime(ann.timestamp)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {activeClipId === clip._id ? (
                    <form
                      onSubmit={(e) => handleAddAnnotation(e, clip._id)}
                      className="flex items-center space-x-2 mt-2"
                    >
                      <input
                        type="number"
                        placeholder="Time (sec)"
                        value={annotationTimestamp}
                        onChange={(e) => setAnnotationTimestamp(e.target.value)}
                        className="w-24 rounded border p-1 text-sm"
                        required
                        min={clip.startTime}
                        max={clip.endTime}
                      />
                      <input
                        type="text"
                        placeholder="Annotation note..."
                        value={annotationText}
                        onChange={(e) => setAnnotationText(e.target.value)}
                        className="flex-1 rounded border p-1 text-sm"
                        required
                      />
                      <button
                        type="submit"
                        className="bg-blue-100 text-blue-700 px-3 py-1 rounded text-sm hover:bg-blue-200"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveClipId(null)}
                        className="text-gray-500 text-sm ml-2 hover:underline"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => {
                        setActiveClipId(clip._id);
                        setAnnotationText("");
                        setAnnotationTimestamp("");
                      }}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      + Add Annotation
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClipManager;
