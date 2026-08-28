import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Loader2, Play } from "lucide-react";
import PlaybookGuidancePanel from "../PlaybookGuidancePanel.jsx";
import {
  fetchPlaybookById,
  fetchPlaybooks,
} from "../../api/meetingPlaybookApi.js";
import { useMeetingPlaybook } from "../../hooks/useMeetingPlaybook.js";

const MeetingRoomPlaybookPanel = ({ socket, meetingId, isFacilitator }) => {
  const { playbookState, startPlaybook, advanceStep, emitTimerWarning } =
    useMeetingPlaybook(socket, meetingId);
  const [playbooks, setPlaybooks] = useState([]);
  const [activePlaybook, setActivePlaybook] = useState(null);
  const [selectedPlaybookId, setSelectedPlaybookId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadPlaybooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPlaybooks();
      setPlaybooks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load playbooks:", err);
      setError("Unable to load playbooks.");
      setPlaybooks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlaybooks();
  }, [loadPlaybooks]);

  useEffect(() => {
    const playbookId = playbookState.playbookId;
    if (!playbookId) {
      setActivePlaybook(null);
      return;
    }

    let cancelled = false;
    const loadActivePlaybook = async () => {
      try {
        const playbook = await fetchPlaybookById(playbookId);
        if (!cancelled) {
          setActivePlaybook(playbook);
        }
      } catch (err) {
        console.error("Failed to load active playbook:", err);
        if (!cancelled) {
          setError("Unable to load the active playbook.");
        }
      }
    };

    loadActivePlaybook();
    return () => {
      cancelled = true;
    };
  }, [playbookState.playbookId]);

  useEffect(() => {
    if (selectedPlaybookId || !playbooks.length) return;
    setSelectedPlaybookId(playbooks[0]._id);
  }, [playbooks, selectedPlaybookId]);

  const handleStartPlaybook = () => {
    if (!selectedPlaybookId) return;
    startPlaybook(selectedPlaybookId);
  };

  if (loading) {
    return (
      <div
        className="flex items-center justify-center gap-2 py-12 text-gray-400"
        role="status"
      >
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        <span>Loading playbook guidance...</span>
      </div>
    );
  }

  if (error && !activePlaybook) {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-950/20 p-4 text-sm text-red-200">
        <p>{error}</p>
        <button
          type="button"
          onClick={loadPlaybooks}
          className="mt-3 text-red-100 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (playbookState.isActive && activePlaybook) {
    return (
      <PlaybookGuidancePanel
        playbook={activePlaybook}
        playbookState={playbookState}
        advanceStep={advanceStep}
        emitTimerWarning={emitTimerWarning}
        isFacilitator={isFacilitator}
      />
    );
  }

  if (!playbooks.length) {
    return (
      <div
        className="rounded-lg border border-dashed border-gray-700 bg-gray-900 p-6 text-center"
        data-testid="meeting-room-playbook-empty"
      >
        <BookOpen className="mx-auto h-8 w-8 text-indigo-400 mb-3" />
        <h3 className="text-lg font-semibold text-white mb-2">
          No playbook assigned
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          Create or assign a meeting playbook to guide facilitators through live
          steps.
        </p>
        <Link
          to="/playbooks"
          className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Assign a playbook
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="meeting-room-playbook-setup">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">
          Playbook guidance
        </h3>
        <p className="text-sm text-gray-400">
          Start the assigned playbook to share live step prompts with everyone
          in this room.
        </p>
      </div>

      <label className="block text-sm text-gray-300">
        Select playbook
        <select
          value={selectedPlaybookId}
          onChange={(e) => setSelectedPlaybookId(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
        >
          {playbooks.map((playbook) => (
            <option key={playbook._id} value={playbook._id}>
              {playbook.name}
            </option>
          ))}
        </select>
      </label>

      {isFacilitator ? (
        <button
          type="button"
          onClick={handleStartPlaybook}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
        >
          <Play className="h-4 w-4" />
          Start playbook guidance
        </button>
      ) : (
        <p className="text-sm text-gray-500">
          Waiting for a facilitator to start playbook guidance.
        </p>
      )}
    </div>
  );
};

export default MeetingRoomPlaybookPanel;
