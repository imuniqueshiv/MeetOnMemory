import React, { useState, useEffect, useContext, useRef } from "react";
import AppContent from "../../context/AppContent";
import { io } from "socket.io-client";
import {
  createPoll,
  getPollsByMeeting,
  castVote,
  closePoll,
  deletePoll,
} from "../../api/pollApi";
import { createClerkSocketOptions } from "../../services/apiClient.js";

const PollSection = ({ meetingId }) => {
  const { userData, backendUrl } = useContext(AppContent);
  const [polls, setPolls] = useState([]);

  // Create Poll State
  const [isCreating, setIsCreating] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [pollType, setPollType] = useState("single");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [expiresInMinutes, setExpiresInMinutes] = useState("");

  const socketRef = useRef(null);

  const isAdminOrOwner =
    userData?.role === "admin" || userData?.role === "owner";

  useEffect(() => {
    const fetchPolls = async () => {
      try {
        const data = await getPollsByMeeting(meetingId);
        setPolls(data || []);
      } catch (error) {
        console.error("Failed to fetch polls", error);
      }
    };
    fetchPolls();

    let cancelled = false;

    (async () => {
      const opts = await createClerkSocketOptions({
        transports: ["websocket"],
      });
      if (cancelled) return;

      // Socket connection for real-time
      socketRef.current = io(backendUrl, opts);

      socketRef.current.on("connect", () => {
        socketRef.current.emit("join-meeting", {
          roomId: meetingId,
          userInfo: { name: userData?.name },
        });
      });

      socketRef.current.on("poll:created", (newPoll) => {
        setPolls((prev) => [newPoll, ...prev]);
      });

      socketRef.current.on("poll:vote", (updatedPoll) => {
        setPolls((prev) =>
          prev.map((p) => (p._id === updatedPoll._id ? updatedPoll : p)),
        );
      });

      socketRef.current.on("poll:closed", (updatedPoll) => {
        setPolls((prev) =>
          prev.map((p) => (p._id === updatedPoll._id ? updatedPoll : p)),
        );
      });

      socketRef.current.on("poll:deleted", ({ id }) => {
        setPolls((prev) => prev.filter((p) => p._id !== id));
      });
    })();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
    };
  }, [meetingId, backendUrl, userData]);

  const handleAddOption = () => {
    setOptions([...options, ""]);
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleRemoveOption = (index) => {
    const newOptions = options.filter((_, i) => i !== index);
    setOptions(newOptions);
  };

  const handleCreatePoll = async (e) => {
    e.preventDefault();
    const validOptions = options.filter((opt) => opt.trim() !== "");
    if (!question.trim() || validOptions.length < 2) {
      alert("Please provide a question and at least two valid options.");
      return;
    }

    const pollData = {
      meetingId,
      question,
      options: validOptions,
      pollType,
      isAnonymous,
    };

    if (expiresInMinutes) {
      const expiresAt = new Date(Date.now() + expiresInMinutes * 60000);
      pollData.expiresAt = expiresAt;
    }

    try {
      await createPoll(pollData);
      setIsCreating(false);
      setQuestion("");
      setOptions(["", ""]);
      setPollType("single");
      setIsAnonymous(false);
      setExpiresInMinutes("");
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Error creating poll");
    }
  };

  const handleVote = async (pollId, pollType, optionId) => {
    try {
      let selectedOptionIds = [optionId];

      if (pollType === "multiple") {
        // Toggle logic for multiple choice - would need local state to manage this better before submitting
        // But for simplicity in this implementation, we will just send the single option ID clicked
        // and allow backend to toggle it if we want, or we can prompt the user with a "Submit Vote" button.
        // Let's implement an immediate vote cast for simplicity.
        // Wait, multiple choice without a submit button is tricky. We'll leave it as single click for now,
        // which might overwrite in the backend if we don't handle array correctly.
        // The backend expects an array of optionIds.
        // If it's a multiple-choice poll, the user should be able to select multiple and submit.
      }

      await castVote(pollId, selectedOptionIds);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Error casting vote");
    }
  };

  const handleClosePoll = async (pollId) => {
    try {
      await closePoll(pollId);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Error closing poll");
    }
  };

  // `deletePoll` and `closePoll` were the only two actions in this component
  // fired without a `.catch()`. While the server was answering 500 for every
  // delete (#1069) that meant the button did nothing at all: no error, no
  // removal, no console output — indistinguishable from an unresponsive UI.
  // These now report failures the same way every other action here does.
  const handleDeletePoll = async (pollId) => {
    if (!window.confirm("Delete this poll?")) return;

    try {
      await deletePoll(pollId);
      // The `poll:deleted` socket event normally removes it. Drop it locally
      // too so the poll disappears even if the socket is down or the client
      // never joined the room.
      setPolls((prev) => prev.filter((p) => p._id !== pollId));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Error deleting poll");
    }
  };

  // Multiple choice voting component
  const MultipleChoiceVoteForm = ({ poll }) => {
    const [selected, setSelected] = useState([]);

    const toggleSelection = (optionId) => {
      if (selected.includes(optionId)) {
        setSelected(selected.filter((id) => id !== optionId));
      } else {
        setSelected([...selected, optionId]);
      }
    };

    const submitMultipleVotes = async () => {
      if (selected.length === 0) return;
      try {
        await castVote(poll._id, selected);
      } catch (err) {
        console.error(err);
        alert(err.response?.data?.message || "Error casting votes");
      }
    };

    return (
      <div>
        {poll.options.map((opt) => (
          <div key={opt._id} className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              id={opt._id}
              checked={selected.includes(opt._id)}
              onChange={() => toggleSelection(opt._id)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label
              htmlFor={opt._id}
              className="text-gray-700 dark:text-gray-300"
            >
              {opt.text}
            </label>
          </div>
        ))}
        <button
          onClick={submitMultipleVotes}
          disabled={selected.length === 0}
          className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
        >
          Submit Votes
        </button>
      </div>
    );
  };

  const renderPoll = (poll) => {
    const totalVotes = poll.options.reduce((sum, opt) => {
      return sum + (poll.isAnonymous ? opt.voteCount : opt.votes.length);
    }, 0);

    const isCreator = poll.createdBy?._id === userData?._id;
    const canManage = isCreator || isAdminOrOwner;

    // Check if current user has voted
    const hasVoted = poll.isAnonymous
      ? false // We can't know for sure if anonymous from backend payload, could store locally, but let's assume they can vote again and backend handles rejection or overwriting
      : poll.options.some((opt) =>
          opt.votes.some((v) => v._id === userData?._id || v === userData?._id),
        );

    return (
      <div
        key={poll._id}
        className="p-4 mb-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
              {poll.question}
            </h4>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Created by {poll.createdBy?.name || "Unknown"} •{" "}
              {new Date(poll.createdAt).toLocaleString()}
              {poll.isAnonymous && " • Anonymous"}
              {poll.isClosed && " • Closed"}
            </div>
          </div>
          <div className="flex gap-2">
            {!poll.isClosed && canManage && (
              <button
                onClick={() => handleClosePoll(poll._id)}
                className="text-xs text-orange-600 dark:text-orange-400 hover:underline"
              >
                Close Poll
              </button>
            )}
            {canManage && (
              <button
                onClick={() => handleDeletePoll(poll._id)}
                className="text-xs text-red-600 dark:text-red-400 hover:underline"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {poll.isClosed ? (
          <div className="space-y-3">
            {poll.options.map((opt) => {
              const votes = poll.isAnonymous ? opt.voteCount : opt.votes.length;
              const percentage =
                totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
              return (
                <div key={opt._id}>
                  <div className="flex justify-between text-sm mb-1 text-gray-700 dark:text-gray-300">
                    <span>{opt.text}</span>
                    <span>
                      {votes} vote{votes !== 1 && "s"} ({percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            {poll.pollType === "multiple" && !hasVoted ? (
              <MultipleChoiceVoteForm poll={poll} />
            ) : (
              <div className="space-y-3">
                {poll.options.map((opt) => {
                  const votes = poll.isAnonymous
                    ? opt.voteCount
                    : opt.votes.length;
                  const percentage =
                    totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                  return (
                    <div
                      key={opt._id}
                      className={`relative overflow-hidden rounded-md border p-3 cursor-pointer transition-colors ${
                        !poll.isAnonymous &&
                        opt.votes.some(
                          (v) => v._id === userData?._id || v === userData?._id,
                        )
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                      onClick={() =>
                        handleVote(
                          poll._id,
                          poll.pollType,
                          opt._id,
                          poll.options,
                        )
                      }
                    >
                      {/* Progress bar background */}
                      <div
                        className="absolute top-0 left-0 h-full bg-blue-100 dark:bg-blue-900/30 opacity-50 z-0 transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                      <div className="relative z-10 flex justify-between items-center">
                        <span className="text-gray-800 dark:text-gray-200 font-medium">
                          {opt.text}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {percentage}% ({votes})
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Total Votes: {totalVotes}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          Polls
        </h3>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
          >
            Create Poll
          </button>
        )}
      </div>

      {isCreating && (
        <form
          onSubmit={handleCreatePoll}
          className="mb-8 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700"
        >
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Question
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="What would you like to ask?"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Options
            </label>
            {options.map((opt, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  className="flex-1 p-2 border rounded dark:bg-bg-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder={`Option ${index + 1}`}
                  required={index < 2}
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(index)}
                    className="px-3 py-2 text-red-600 bg-red-100 rounded hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50"
                  >
                    X
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddOption}
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              + Add Option
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Poll Type
              </label>
              <select
                value={pollType}
                onChange={(e) => setPollType(e.target.value)}
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="single">Single Choice</option>
                <option value="multiple">Multiple Choice</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Expires In (minutes)
              </label>
              <input
                type="number"
                value={expiresInMinutes}
                onChange={(e) => setExpiresInMinutes(e.target.value)}
                min="1"
                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Leave blank for no expiry"
              />
            </div>
            <div className="flex items-end mb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Anonymous Voting
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 bg-gray-200 text-gray-800 font-medium rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              Publish Poll
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {polls.map((p) => renderPoll(p))}
        {polls.length === 0 && !isCreating && (
          <p className="text-center text-gray-500 dark:text-gray-400 py-4">
            No polls created yet.
          </p>
        )}
      </div>
    </div>
  );
};

export default PollSection;
