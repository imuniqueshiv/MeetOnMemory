// client/src/components/meeting-room/LiveActionBoard.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus,
  GripVertical,
  AlertTriangle,
  Sparkles,
  User,
} from "lucide-react";
import apiClient from "../../services/apiClient.js";

const COLUMNS = [
  {
    id: "backlog",
    title: "Backlog",
    color: "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700",
  },
  {
    id: "in-progress",
    title: "In Progress",
    color:
      "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
  },
  {
    id: "blocked",
    title: "Blocked",
    color: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
  },
  {
    id: "done",
    title: "Done",
    color:
      "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800",
  },
];

const PRIORITIES = {
  high: {
    label: "High",
    color:
      "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-800",
  },
  medium: {
    label: "Med",
    color:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
  },
  low: {
    label: "Low",
    color:
      "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 border-green-200 dark:border-green-800",
  },
};

const itemMatchesId = (item, actionId) => {
  if (!item || actionId == null) return false;
  const target = String(actionId);
  return String(item._id ?? "") === target || String(item.id ?? "") === target;
};

const isSyncPlaceholder = (item) =>
  Boolean(item?.__pendingSync) || item?.title === "Syncing...";

const findItemInColumns = (columns, actionId) => {
  for (const col of Object.keys(columns)) {
    const found = (columns[col] || []).find((item) =>
      itemMatchesId(item, actionId),
    );
    if (found) return found;
  }
  return null;
};

/**
 * Apply a remote column move. Prefers the broadcast item, then the local copy,
 * and only falls back to a temporary Syncing placeholder when neither exists.
 */
const applyRemoteMove = (prevColumns, data) => {
  const newCols = JSON.parse(JSON.stringify(prevColumns));
  const existingItem = findItemInColumns(newCols, data.actionId);
  const usableLocalItem =
    existingItem && !isSyncPlaceholder(existingItem) ? existingItem : null;

  for (const col of Object.keys(newCols)) {
    newCols[col] = (newCols[col] || []).filter(
      (item) => !itemMatchesId(item, data.actionId),
    );
  }

  if (!newCols[data.toColumn]) newCols[data.toColumn] = [];

  let movedItem = null;
  if (
    data.item &&
    !isSyncPlaceholder(data.item) &&
    (data.item.title || data.item._id || data.item.id)
  ) {
    movedItem = {
      ...data.item,
      _id: data.item._id || data.item.id || data.actionId,
    };
  } else if (usableLocalItem) {
    movedItem = usableLocalItem;
  }

  const needsHydration = !movedItem;
  if (!movedItem) {
    movedItem = {
      _id: data.actionId,
      title: "Syncing...",
      priority: "medium",
      __pendingSync: true,
    };
  }

  const insertAt = Math.max(
    0,
    Math.min(
      data.newIndex ?? newCols[data.toColumn].length,
      newCols[data.toColumn].length,
    ),
  );
  newCols[data.toColumn].splice(insertAt, 0, movedItem);

  return { columns: newCols, needsHydration };
};

const LiveActionBoard = ({ socket, meetingId, userId, participants }) => {
  const [columns, setColumns] = useState({
    backlog: [],
    "in-progress": [],
    blocked: [],
    done: [],
  });
  const [aiWarnings, setAiWarnings] = useState([]);
  const [_aiStatus, setAiStatus] = useState("healthy");
  const [newItemTitle, setNewItemTitle] = useState("");
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);
  const hydrateTimerRef = useRef(null);
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  const fetchBoardState = useCallback(async () => {
    if (!meetingId) return;
    try {
      const res = await apiClient.get(`/api/workspace/${meetingId}/state`);
      if (res.data.success && res.data.warRoom?.actionColumns) {
        setColumns(res.data.warRoom.actionColumns);
      }
    } catch (err) {
      console.error("Failed to load action board:", err);
    }
  }, [meetingId]);

  const scheduleHydration = useCallback(() => {
    if (hydrateTimerRef.current) clearTimeout(hydrateTimerRef.current);
    // Debounce rapid consecutive incomplete moves into a single refetch.
    hydrateTimerRef.current = setTimeout(() => {
      fetchBoardState();
    }, 250);
  }, [fetchBoardState]);

  // --- INITIAL LOAD ---
  useEffect(() => {
    fetchBoardState();
  }, [fetchBoardState]);

  useEffect(() => {
    return () => {
      if (hydrateTimerRef.current) clearTimeout(hydrateTimerRef.current);
    };
  }, []);

  // --- SOCKET LISTENERS ---
  useEffect(() => {
    if (!socket) return;

    const handleRemoteMove = (data) => {
      if (data.userId === userId) return; // Ignore own moves

      const hasRemoteItem = Boolean(
        data.item &&
        (data.item.title || data.item._id || data.item.id) &&
        !isSyncPlaceholder(data.item),
      );
      const localItem = findItemInColumns(columnsRef.current, data.actionId);
      const hasLocalItem = Boolean(localItem && !isSyncPlaceholder(localItem));
      // Only refetch when we would otherwise be stuck on a Syncing placeholder.
      const needsHydration = !hasRemoteItem && !hasLocalItem;

      setColumns((prev) => applyRemoteMove(prev, data).columns);

      if (needsHydration) {
        scheduleHydration();
      }
    };

    const handleAiBottleneck = (data) => {
      setAiWarnings(data.warnings || []);
      setAiStatus(data.status || "healthy");
    };

    socket.on("workspace:action-move", handleRemoteMove);
    socket.on("workspace:ai-bottleneck", handleAiBottleneck);

    return () => {
      socket.off("workspace:action-move", handleRemoteMove);
      socket.off("workspace:ai-bottleneck", handleAiBottleneck);
    };
  }, [socket, userId, scheduleHydration]);

  // --- DRAG & DROP HANDLERS ---
  const handleDragStart = (e, item, colId) => {
    dragItem.current = { item, colId };
    e.dataTransfer.effectAllowed = "move";
    // Add visual feedback
    setTimeout(() => e.target.classList.add("opacity-50"), 0);
  };

  const handleDragEnd = (e) => {
    e.target.classList.remove("opacity-50");
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const handleDragOver = (e, item, colId) => {
    e.preventDefault();
    dragOverItem.current = { item, colId };
  };

  const handleDrop = (e, targetColId) => {
    e.preventDefault();
    if (!dragItem.current) return;

    const { item: draggedItem, colId: fromCol } = dragItem.current;
    const targetItem = dragOverItem.current?.item;

    setColumns((prev) => {
      const newCols = JSON.parse(JSON.stringify(prev));

      // Remove from source
      newCols[fromCol] = newCols[fromCol].filter(
        (i) => !itemMatchesId(i, draggedItem._id ?? draggedItem.id),
      );

      // Calculate new index
      let newIndex = newCols[targetColId].length;
      if (targetItem) {
        newIndex = newCols[targetColId].findIndex((i) =>
          itemMatchesId(i, targetItem._id ?? targetItem.id),
        );
        if (newIndex === -1) newIndex = newCols[targetColId].length;
      }

      // Insert at target
      newCols[targetColId].splice(newIndex, 0, draggedItem);

      // Emit full item so remotes can hydrate immediately (Issue #1213).
      if (socket) {
        socket.emit("workspace:action-move", {
          actionId: draggedItem._id || draggedItem.id,
          fromColumn: fromCol,
          toColumn: targetColId,
          newIndex,
          item: draggedItem,
        });
      }

      return newCols;
    });
  };

  // --- ADD NEW ITEM ---
  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItemTitle.trim()) return;

    try {
      const res = await apiClient.post(`/api/workspace/${meetingId}/action`, {
        title: newItemTitle.trim(),
        priority: "medium",
      });

      if (res.data.success) {
        setColumns((prev) => ({
          ...prev,
          backlog: [...prev.backlog, res.data.item],
        }));
        setNewItemTitle("");
      }
    } catch (err) {
      console.error("Failed to add item:", err);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-gray-50 rounded-xl border border-gray-200 shadow-sm overflow-hidden dark:bg-gray-900 dark:border-gray-700">
      {/* HEADER & AI WARNINGS */}
      <div className="border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" /> Live Action Board
          </h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {Object.values(columns).flat().length} total tasks
          </span>
        </div>

        {/* AI Bottleneck Warnings */}
        {aiWarnings.length > 0 && (
          <div className="mb-3 rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-800 dark:bg-orange-950/40">
            <div className="flex items-center gap-2 text-orange-800 dark:text-orange-300 mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-bold">AI Bottleneck Detected</span>
            </div>
            <ul className="space-y-1">
              {aiWarnings.map((w, idx) => (
                <li
                  key={idx}
                  className="text-xs text-orange-700 dark:text-orange-400"
                >
                  <strong>{w.user}:</strong> {w.suggestion}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Add Item Form */}
        <form onSubmit={handleAddItem} className="flex gap-2">
          <input
            type="text"
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            placeholder="Add new action item to backlog..."
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          />
          <button
            type="submit"
            className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            disabled={!newItemTitle.trim()}
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </form>
      </div>

      {/* KANBAN COLUMNS */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-4 h-full min-w-max">
          {COLUMNS.map((col) => (
            <div
              key={col.id}
              className={`w-72 flex flex-col rounded-lg border-2 border-dashed ${col.color} p-2 transition-colors`}
              onDragOver={(e) => handleDragOver(e, null, col.id)}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <h4 className="text-sm font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300">
                  {col.title}
                </h4>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                  {columns[col.id]?.length || 0}
                </span>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-1">
                {columns[col.id]?.map((item) => (
                  <div
                    key={item._id || item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item, col.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, item, col.id)}
                    className="group cursor-grab rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-all hover:shadow-md active:cursor-grabbing dark:border-gray-700 dark:bg-gray-800"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug">
                        {item.title}
                      </p>
                      <GripVertical className="w-4 h-4 shrink-0 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${PRIORITIES[item.priority]?.color || PRIORITIES.medium.color}`}
                      >
                        {PRIORITIES[item.priority]?.label || "Med"}
                      </span>

                      {item.assignee ? (
                        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <User className="w-3 h-3" />
                          <span className="truncate max-w-[80px]">
                            {participants.find(
                              (p) => p.user?._id === item.assignee,
                            )?.name || "Assigned"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic">
                          Unassigned
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {(!columns[col.id] || columns[col.id].length === 0) && (
                  <div className="flex h-24 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-xs text-gray-400 dark:border-gray-600">
                    Drop tasks here
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LiveActionBoard;
