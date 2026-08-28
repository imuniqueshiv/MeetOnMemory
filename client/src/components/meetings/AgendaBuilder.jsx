import React, { useState, useEffect, useCallback } from "react";
import { io } from "socket.io-client";
import { toast } from "react-toastify";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import * as agendaBuilderApi from "../../services/agendaBuilderApi";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const AgendaBuilder = ({ meetingId, isOrganizer, userRole }) => {
  // const { user } = useUser(); // unused
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTopicText, setNewTopicText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  // const [socket, setSocket] = useState(null);

  const fetchProposals = useCallback(async () => {
    try {
      const data = await agendaBuilderApi.getProposals(meetingId);
      setProposals(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load proposals");
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    fetchProposals();

    const newSocket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    newSocket.on("connect", () => {
      newSocket.emit("join_meeting", { meetingId });
    });

    newSocket.on("agenda:proposal:new", (proposal) => {
      setProposals((prev) => [...prev, proposal]);
    });

    newSocket.on("agenda:proposal:updated", (updatedProposal) => {
      setProposals((prev) =>
        prev.map((p) => (p._id === updatedProposal._id ? updatedProposal : p)),
      );
    });

    newSocket.on("agenda:proposals:reordered", (orderedProposals) => {
      setProposals(orderedProposals);
    });

    newSocket.on("agenda:proposals:batch", (newProposals) => {
      setProposals((prev) => [...prev, ...newProposals]);
    });

    // setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [meetingId, fetchProposals]);

  const handlePropose = async (e) => {
    e.preventDefault();
    if (!newTopicText.trim()) return;
    try {
      await agendaBuilderApi.createProposal(meetingId, { text: newTopicText });
      setNewTopicText("");
    } catch (err) {
      console.error(err);
      toast.error("Failed to propose topic");
    }
  };

  const handleVote = async (proposalId) => {
    try {
      // Toggle logic: if you want to upvote, pass 1. (Simple version: always pass 1 for upvote)
      // Assuming a simplistic toggle if clicking the same button.
      await agendaBuilderApi.voteProposal(meetingId, proposalId, 1);
    } catch (err) {
      console.error(err);
      toast.error("Failed to vote");
    }
  };

  const handleStatusChange = async (proposalId, status) => {
    try {
      await agendaBuilderApi.updateProposalStatus(
        meetingId,
        proposalId,
        status,
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status");
    }
  };

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    try {
      await agendaBuilderApi.generateAiProposals(meetingId, {
        /* dummy context for now */
      });
      toast.success("AI suggestions generated!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate suggestions");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFinalize = async () => {
    try {
      await agendaBuilderApi.finalizeAgenda(meetingId);
      toast.success("Agenda finalized successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to finalize agenda");
    }
  };

  const onDragEnd = async (result) => {
    if (!result.destination || !isOrganizer) return;

    const { source, destination } = result;
    if (
      source.droppableId !== "accepted" ||
      destination.droppableId !== "accepted"
    ) {
      return; // only reorder accepted items
    }

    const acceptedProposals = proposals
      .filter((p) => p.status === "accepted")
      .sort((a, b) => a.position - b.position);

    const reordered = Array.from(acceptedProposals);
    const [moved] = reordered.splice(source.index, 1);
    reordered.splice(destination.index, 0, moved);

    const orderedIds = reordered.map((p) => p._id);

    // Optimistic UI update
    setProposals((prev) => {
      const newProposals = [...prev];
      reordered.forEach((item, index) => {
        const found = newProposals.find((p) => p._id === item._id);
        if (found) found.position = index;
      });
      return newProposals;
    });

    try {
      await agendaBuilderApi.reorderProposals(meetingId, orderedIds);
    } catch (err) {
      console.error(err);
      toast.error("Failed to reorder");
      fetchProposals(); // revert
    }
  };

  const pendingProposals = proposals
    .filter((p) => p.status === "proposed")
    .sort((a, b) => b.voteScore - a.voteScore);

  const acceptedProposals = proposals
    .filter((p) => p.status === "accepted")
    .sort((a, b) => a.position - b.position);

  if (loading) return <div>Loading Builder...</div>;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mt-6 mb-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Collaborative Agenda Builder
        </h2>
        {isOrganizer && (
          <div className="space-x-2">
            <button
              onClick={handleGenerateAI}
              disabled={isGenerating}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isGenerating ? "Generating..." : "AI Suggest Topics"}
            </button>
            <button
              onClick={handleFinalize}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Finalize Agenda
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Proposed Topics */}
        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Proposed Topics
          </h3>

          <form onSubmit={handlePropose} className="mb-4 flex gap-2">
            <input
              type="text"
              value={newTopicText}
              onChange={(e) => setNewTopicText(e.target.value)}
              placeholder="Suggest a topic..."
              disabled={userRole === "observer"}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={userRole === "observer"}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50"
            >
              Propose
            </button>
          </form>

          <div className="space-y-3">
            {pendingProposals.map((proposal) => (
              <div
                key={proposal._id}
                className="bg-white dark:bg-gray-800 p-3 rounded shadow-sm border border-gray-200 dark:border-gray-700 flex justify-between items-start"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {proposal.text}
                  </p>
                  <p className="text-xs text-gray-500">
                    {proposal.source === "ai"
                      ? "🤖 AI Suggested"
                      : "👤 Participant"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleVote(proposal._id, 1)}
                    disabled={userRole === "observer"}
                    className="flex items-center gap-1 text-gray-500 hover:text-blue-600 disabled:opacity-50"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 15l7-7 7 7"
                      ></path>
                    </svg>
                    <span className="text-sm">{proposal.voteScore}</span>
                  </button>
                  {isOrganizer && (
                    <button
                      onClick={() =>
                        handleStatusChange(proposal._id, "accepted")
                      }
                      className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 ml-2"
                    >
                      Accept
                    </button>
                  )}
                </div>
              </div>
            ))}
            {pendingProposals.length === 0 && (
              <p className="text-gray-500 text-sm">No pending proposals.</p>
            )}
          </div>
        </div>

        {/* Right Column: Accepted Agenda */}
        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Accepted Agenda
          </h3>

          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="accepted">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-3 min-h-[100px]"
                >
                  {acceptedProposals.map((proposal, index) => (
                    <Draggable
                      key={proposal._id}
                      draggableId={proposal._id}
                      index={index}
                      isDragDisabled={!isOrganizer}
                    >
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`bg-white dark:bg-gray-800 p-3 rounded shadow-sm border border-gray-200 dark:border-gray-700 flex justify-between items-center ${isOrganizer ? "cursor-grab active:cursor-grabbing" : ""}`}
                        >
                          <div className="flex items-center gap-2">
                            {isOrganizer && (
                              <svg
                                className="w-4 h-4 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M4 6h16M4 12h16M4 18h16"
                                ></path>
                              </svg>
                            )}
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {proposal.text}
                            </span>
                          </div>
                          {isOrganizer && (
                            <button
                              onClick={() =>
                                handleStatusChange(proposal._id, "proposed")
                              }
                              className="text-xs text-red-500 hover:text-red-700"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  {acceptedProposals.length === 0 && (
                    <p className="text-gray-500 text-sm">
                      No accepted items yet.
                    </p>
                  )}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      </div>
    </div>
  );
};

export default AgendaBuilder;
