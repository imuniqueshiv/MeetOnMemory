import React, { useMemo, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import Placeholder from "@tiptap/extension-placeholder";
import { History } from "lucide-react";
import { useCollaborativeNote } from "../../hooks/useCollaborativeNote";
import PresenceAvatars from "./PresenceAvatars";
import VersionHistory from "./VersionHistory";
import NoteVersionHistory from "../NoteVersionHistory";
import CollabSyncStatusChip from "./CollabSyncStatusChip";
import NoteTemplateSelector from "./NoteTemplateSelector";

/**
 * @desc Main collaborative editor pane (Tiptap + Yjs). Remount via `key` after
 * a note-version restore so the CRDT reconnects to the restored document.
 */
const CollaborativeEditorPane = ({
  meetingId,
  isReadOnly = false,
  onOpenHistory,
}) => {
  const {
    ydoc,
    isConnected,
    isLoading,
    syncStatus,
    activeUsers,
    userColor,
    broadcastCursor,
    saveSnapshot,
  } = useCollaborativeNote(meetingId, isReadOnly);

  const extensions = useMemo(() => {
    const baseExtensions = [
      StarterKit.configure({
        // Disable history because Yjs handles undo/redo via CRDT
        history: false,
      }),
      Collaboration.configure({
        document: ydoc,
        field: "collaborative-note",
      }),
      Placeholder.configure({
        placeholder: isReadOnly
          ? ""
          : "Start typing your meeting notes here...",
      }),
    ];

    // Only enable cursor tracking if user can edit
    if (!isReadOnly) {
      baseExtensions.push(
        CollaborationCursor.configure({
          user: {
            name: "You", // Will be overridden by provider if needed
            color: userColor,
          },
          render: (user) => {
            const cursor = document.createElement("span");
            cursor.classList.add("collaboration-cursor__caret");
            cursor.setAttribute("style", `border-color: ${user.color}`);

            const label = document.createElement("div");
            label.classList.add("collaboration-cursor__label");
            label.setAttribute("style", `background-color: ${user.color}`);
            label.insertBefore(document.createTextNode(user.name), null);
            cursor.insertBefore(label, null);

            return cursor;
          },
        }),
      );
    }

    return baseExtensions;
  }, [ydoc, isReadOnly, userColor]);

  const editor = useEditor({
    extensions,
    editable: !isReadOnly,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none focus:outline-none dark:prose-invert min-h-[400px] px-8 py-4",
      },
    },
    onUpdate: ({ editor: ed }) => {
      const { from, to } = ed.state.selection;
      broadcastCursor(from, to);
    },
    onSelectionUpdate: ({ editor: ed }) => {
      const { from, to } = ed.state.selection;
      broadcastCursor(from, to);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-200px)] bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Left Sidebar: Version History */}
      <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex-shrink-0 hidden md:block">
        <VersionHistory
          meetingId={meetingId}
          onSaveSnapshot={saveSnapshot}
          onOpenFullHistory={onOpenHistory}
        />
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar: Connection Status & Active Users */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`}
                aria-hidden="true"
              ></div>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                {isConnected
                  ? isReadOnly
                    ? "Viewing Live"
                    : "Connected"
                  : "Disconnected"}
              </span>
            </div>
            <CollabSyncStatusChip
              syncStatus={syncStatus}
              isReadOnly={isReadOnly}
            />
          </div>

          <div className="flex items-center gap-3">
            {!isReadOnly && editor && (
              <NoteTemplateSelector
                disabled={isReadOnly || !editor}
                onApplyTemplate={(htmlContent) => {
                  if (editor) {
                    editor.commands.insertContent(htmlContent);
                  }
                }}
              />
            )}
            <button
              type="button"
              onClick={onOpenHistory}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              data-testid="open-note-version-history"
            >
              <History className="w-3.5 h-3.5" />
              Diff & Restore
            </button>
            <PresenceAvatars users={activeUsers} />
          </div>
        </div>

        {/* Tiptap Editor Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* CSS for Collaboration Cursors */}
      <style jsx global>{`
        .collaboration-cursor__caret {
          border-left: 1px solid #0d0d0d;
          border-right: 1px solid #0d0d0d;
          margin-left: -1px;
          margin-right: -1px;
          pointer-events: none;
          position: relative;
          word-break: normal;
        }
        .collaboration-cursor__label {
          border-radius: 3px 3px 3px 0;
          color: #0d0d0d;
          font-size: 12px;
          font-weight: 600;
          left: -1px;
          line-height: normal;
          padding: 0.1rem 0.3rem;
          position: absolute;
          top: -1.4em;
          user-select: none;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
};

/**
 * @desc Collaborative notes editor with NoteVersionHistory restore/diff dialog.
 */
const CollaborativeEditor = ({ meetingId, isReadOnly = false }) => {
  const [showHistory, setShowHistory] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const handleRestored = useCallback(() => {
    setShowHistory(false);
    // Remount so the CRDT reconnects against the restored meeting state
    setReloadKey((key) => key + 1);
  }, []);

  return (
    <>
      <CollaborativeEditorPane
        key={reloadKey}
        meetingId={meetingId}
        isReadOnly={isReadOnly}
        onOpenHistory={() => setShowHistory(true)}
      />
      {showHistory && (
        <NoteVersionHistory
          meetingId={meetingId}
          field="collaborativeNotes"
          onClose={() => setShowHistory(false)}
          onRestored={handleRestored}
        />
      )}
    </>
  );
};

export default CollaborativeEditor;
