// client/src/components/meeting-room/CollaborativeCanvas.jsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  MousePointer2,
  Square,
  Circle,
  Minus,
  Type,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Undo2,
  Redo2,
} from "lucide-react";

const TOOLS = {
  SELECT: "select",
  RECT: "rect",
  CIRCLE: "circle",
  LINE: "line",
  TEXT: "text",
};

const COLORS = [
  "#6366f1",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#64748b",
];

/**
 * CollaborativeCanvas - Real-time SVG whiteboard with history and remote cursors
 */
const CollaborativeCanvas = ({ socket, userId, userColor }) => {
  const svgRef = useRef(null);
  const [tool, setTool] = useState(TOOLS.SELECT);
  const [color, setColor] = useState(userColor || "#6366f1");
  const [elements, setElements] = useState([]); // { id, type, x, y, w, h, color, text }
  const [history, setHistory] = useState([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // ViewBox for Pan & Zoom
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 1000, h: 600 });

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentElement, setCurrentElement] = useState(null);

  // Remote Cursors
  const [remoteCursors, setRemoteCursors] = useState({});

  // --- SOCKET EVENT LISTENERS ---
  useEffect(() => {
    if (!socket) return;

    const handleRemoteDraw = (data) => {
      if (data.userId === userId) return;
      setElements((prev) => {
        const nextElements = [...prev, data.payload];
        pushHistory(nextElements);
        return nextElements;
      });
    };

    const handleRemoteCursor = (data) => {
      if (data.userId === userId) return;
      setRemoteCursors((prev) => ({
        ...prev,
        [data.userId]: {
          x: data.x,
          y: data.y,
          name: data.userName,
          color: data.color,
        },
      }));
    };

    const handleClear = () => {
      setElements([]);
      pushHistory([]);
    };

    const handleUserLeft = (data) => {
      setRemoteCursors((prev) => {
        const newState = { ...prev };
        delete newState[data.userId];
        return newState;
      });
    };

    socket.on("workspace:canvas-draw", handleRemoteDraw);
    socket.on("workspace:cursor-move", handleRemoteCursor);
    socket.on("workspace:canvas-clear", handleClear);
    socket.on("workspace:user-left", handleUserLeft);

    return () => {
      socket.off("workspace:canvas-draw", handleRemoteDraw);
      socket.off("workspace:cursor-move", handleRemoteCursor);
      socket.off("workspace:canvas-clear", handleClear);
      socket.off("workspace:user-left", handleUserLeft);
    };
  }, [socket, userId, pushHistory]);

  // --- HISTORY MANAGEMENT (UNDO/REDO) ---
  const pushHistory = useCallback(
    (newElements) => {
      setHistory((prevHistory) => {
        const newHistory = prevHistory.slice(0, historyIndex + 1);
        newHistory.push(newElements);
        setHistoryIndex(newHistory.length - 1);
        return newHistory;
      });
    },
    [historyIndex],
  );

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setElements(history[newIndex]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setElements(history[newIndex]);
    }
  };

  // --- SVG COORDINATE MATH ---
  const getSVGPoint = (e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * viewBox.w + viewBox.x;
    const y = ((e.clientY - rect.top) / rect.height) * viewBox.h + viewBox.y;
    return { x, y };
  };

  // --- MOUSE EVENT HANDLERS ---
  const handleMouseDown = (e) => {
    if (tool === TOOLS.SELECT) return;
    const pt = getSVGPoint(e);
    setIsDrawing(true);
    setStartPos(pt);

    const id = `el-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const newEl = {
      id,
      type: tool,
      x: pt.x,
      y: pt.y,
      w: 0,
      h: 0,
      color,
      text: "",
    };
    setCurrentElement(newEl);
  };

  const handleMouseMove = (e) => {
    const pt = getSVGPoint(e);

    // Broadcast cursor position
    if (socket) {
      socket.emit("workspace:cursor-move", {
        x: pt.x,
        y: pt.y,
        canvasId: "main",
      });
    }

    if (!isDrawing || !currentElement) return;

    const w = pt.x - startPos.x;
    const h = pt.y - startPos.y;

    setCurrentElement({
      ...currentElement,
      // Handle negative width/height for dragging up/left
      x: w < 0 ? pt.x : startPos.x,
      y: h < 0 ? pt.y : startPos.y,
      w: Math.abs(w),
      h: Math.abs(h),
    });
  };

  const handleMouseUp = () => {
    if (
      isDrawing &&
      currentElement &&
      (currentElement.w > 2 || currentElement.h > 2)
    ) {
      const finalElements = [...elements, currentElement];
      setElements(finalElements);
      pushHistory(finalElements);

      // Emit to socket
      if (socket) {
        socket.emit("workspace:canvas-draw", {
          type: "node",
          payload: currentElement,
        });
      }
    }
    setIsDrawing(false);
    setCurrentElement(null);
  };

  // --- ZOOM & PAN ---
  const zoom = (factor) => {
    const newW = viewBox.w * factor;
    const newH = viewBox.h * factor;
    const dx = (viewBox.w - newW) / 2;
    const dy = (viewBox.h - newH) / 2;
    setViewBox({
      x: viewBox.x + dx,
      y: viewBox.y + dy,
      w: newW,
      h: newH,
    });
  };

  const resetView = () => setViewBox({ x: 0, y: 0, w: 1000, h: 600 });

  const clearCanvas = () => {
    if (window.confirm("Clear the entire canvas for all participants?")) {
      setElements([]);
      pushHistory([]);
      if (socket) socket.emit("workspace:canvas-clear");
    }
  };

  // --- RENDER ELEMENTS ---
  const renderElement = (el) => {
    switch (el.type) {
      case TOOLS.RECT:
        return (
          <rect
            x={el.x}
            y={el.y}
            width={el.w}
            height={el.h}
            fill="none"
            stroke={el.color}
            strokeWidth="3"
            rx="4"
          />
        );
      case TOOLS.CIRCLE:
        return (
          <ellipse
            cx={el.x + el.w / 2}
            cy={el.y + el.h / 2}
            rx={el.w / 2}
            ry={el.h / 2}
            fill="none"
            stroke={el.color}
            strokeWidth="3"
          />
        );
      case TOOLS.LINE:
        return (
          <line
            x1={el.x}
            y1={el.y}
            x2={el.x + el.w}
            y2={el.y + el.h}
            stroke={el.color}
            strokeWidth="3"
            strokeLinecap="round"
          />
        );
      case TOOLS.TEXT:
        return (
          <text
            x={el.x}
            y={el.y + 20}
            fill={el.color}
            fontSize="16"
            fontFamily="sans-serif"
          >
            Double click to edit
          </text>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full w-full rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-gray-700 dark:bg-gray-900">
      {/* TOOLBAR */}
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-1">
          <ToolBtn
            active={tool === TOOLS.SELECT}
            onClick={() => setTool(TOOLS.SELECT)}
            icon={<MousePointer2 className="w-4 h-4" />}
            title="Select"
          />
          <ToolBtn
            active={tool === TOOLS.RECT}
            onClick={() => setTool(TOOLS.RECT)}
            icon={<Square className="w-4 h-4" />}
            title="Rectangle"
          />
          <ToolBtn
            active={tool === TOOLS.CIRCLE}
            onClick={() => setTool(TOOLS.CIRCLE)}
            icon={<Circle className="w-4 h-4" />}
            title="Circle"
          />
          <ToolBtn
            active={tool === TOOLS.LINE}
            onClick={() => setTool(TOOLS.LINE)}
            icon={<Minus className="w-4 h-4 rotate-[-45deg]" />}
            title="Line"
          />

          <div className="w-px h-6 bg-gray-300 mx-2 dark:bg-gray-600" />

          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-5 h-5 rounded-full border-2 transition-transform ${color === c ? "border-gray-900 scale-125 dark:border-white" : "border-transparent"}`}
              style={{ backgroundColor: c }}
              aria-label={`Select color ${c}`}
            />
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            className="p-1.5 rounded text-gray-600 hover:bg-gray-200 disabled:opacity-30 dark:text-gray-300 dark:hover:bg-gray-700"
            title="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="p-1.5 rounded text-gray-600 hover:bg-gray-200 disabled:opacity-30 dark:text-gray-300 dark:hover:bg-gray-700"
            title="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-gray-300 mx-1 dark:bg-gray-600" />

          <button
            onClick={() => zoom(0.8)}
            className="p-1.5 rounded text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => zoom(1.25)}
            className="p-1.5 rounded text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={resetView}
            className="p-1.5 rounded text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700"
            title="Reset View"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-gray-300 mx-1 dark:bg-gray-600" />

          <button
            onClick={clearCanvas}
            className="p-1.5 rounded text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
            title="Clear Canvas"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* CANVAS AREA */}
      <div className="flex-1 relative overflow-hidden bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px] dark:bg-[radial-gradient(#374151_1px,transparent_1px)]">
        <svg
          ref={svgRef}
          className="w-full h-full cursor-crosshair"
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Rendered Elements */}
          {elements.map(renderElement)}

          {/* Current Drawing Preview */}
          {currentElement && renderElement(currentElement)}

          {/* Remote Cursors */}
          {Object.entries(remoteCursors).map(([uid, cursor]) => (
            <g
              key={uid}
              transform={`translate(${cursor.x}, ${cursor.y})`}
              className="pointer-events-none transition-transform duration-75"
            >
              <path
                d="M0 0 L0 15 L4 11 L9 18 L12 16 L7 9 L13 9 Z"
                fill={cursor.color}
                stroke="#fff"
                strokeWidth="1"
              />
              <rect
                x="12"
                y="16"
                rx="3"
                fill={cursor.color}
                className="px-1.5 py-0.5"
                width={cursor.name.length * 7 + 10}
                height="16"
              />
              <text
                x="17"
                y="28"
                fill="#fff"
                fontSize="10"
                fontFamily="sans-serif"
                fontWeight="bold"
              >
                {cursor.name}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
};

// Helper Toolbar Button Component
const ToolBtn = ({ active, onClick, icon, title }) => (
  <button
    onClick={onClick}
    title={title}
    className={`p-1.5 rounded transition-colors ${
      active
        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
        : "text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700"
    }`}
  >
    {icon}
  </button>
);

export default CollaborativeCanvas;
