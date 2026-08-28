import React, { useState, useEffect } from "react";

export const RetentionManagementWizard = ({
  initialSettings,
  onSaveMemoryPolicy,
  onSaveDataPolicy,
  fetchDeletionPreview,
}) => {
  // 1. Unified Form State Management mapping to distinct backends
  const [memoryDays, setMemoryDays] = useState(
    initialSettings?.memoryDays || 30,
  );
  const [meetingDays, setMeetingDays] = useState(
    initialSettings?.meetingDays || 90,
  );
  const [attachmentDays, setAttachmentDays] = useState(
    initialSettings?.attachmentDays || 180,
  );

  // Simulation and UI State
  const [previewData, setPreviewData] = useState({
    memoryObjects: 0,
    meetingLogs: 0,
    attachmentsBytes: 0,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // 2. Shared Deletion Preview Trigger Loop
  useEffect(() => {
    const triggerSimulation = async () => {
      try {
        const data = await fetchDeletionPreview({
          memoryDays,
          meetingDays,
          attachmentDays,
        });
        setPreviewData(data);
      } catch (err) {
        console.error("[RETENTION_PREVIEW_RECALC_ERR]:", err);
      }
    };

    const debounceTimer = setTimeout(triggerSimulation, 4000);
    return () => clearTimeout(debounceTimer);
  }, [memoryDays, meetingDays, attachmentDays, fetchDeletionPreview]);

  // 3. Consolidated Multi-Backend Save Strategy
  const handleSavePolicies = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);

    try {
      // Dispatch parameters atomitcally to their separate active backend services
      await Promise.all([
        onSaveMemoryPolicy({ retentionDays: memoryDays }),
        onSaveDataPolicy({
          meetingRetentionDays: meetingDays,
          attachmentRetentionDays: attachmentDays,
        }),
      ]);
      setStatusMessage({
        type: "SUCCESS",
        text: "Retention parameters successfully unified and propagated.",
      });
    } catch (err) {
      console.error("Failed to save policies:", err);
      setStatusMessage({
        type: "ERROR",
        text: "Failed to synchronize policies across targeted nodes.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
      {/* Structural Header Section */}
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          🛡️ Centralized Global Data Retention Dashboard
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Configure administrative purging policies across memory nodes,
          communications, and structural file storage from a single interface.
        </p>
      </div>

      <form
        onSubmit={handleSavePolicies}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        {/* Policy Setting Knobs (Left Pane) */}
        <div className="lg:col-span-2 space-y-5">
          {/* Section A: Memory Lifecycle Policy Config (Targeting Memory Service) */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              🧠 AI Memory Lifecycle Policy
            </h3>
            <p className="text-xs text-slate-400">
              Determines how long temporary operational memory embeddings
              survive before clean expiration cycles.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                value={memoryDays}
                onChange={(e) => setMemoryDays(Number(e.target.value))}
                className="w-24 rounded-lg border border-slate-200 bg-white p-2 text-sm font-medium text-slate-800"
              />
              <span className="text-xs font-medium text-slate-600">
                Days until memory block truncation
              </span>
            </div>
          </div>

          {/* Section B: Base Communications & Meetings Data (Targeting Data Retention Service) */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              📊 Core Infrastructure Data Retention
            </h3>
            <p className="text-xs text-slate-400">
              Controls retention lifecycles for relational system artifacts and
              file stores.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600 block">
                  Meeting Audio & Logs
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={meetingDays}
                    onChange={(e) => setMeetingDays(Number(e.target.value))}
                    className="w-24 rounded-lg border border-slate-200 bg-white p-2 text-sm font-medium text-slate-800"
                  />
                  <span className="text-xs text-slate-500">Days</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600 block">
                  Document Attachments
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={attachmentDays}
                    onChange={(e) => setAttachmentDays(Number(e.target.value))}
                    className="w-24 rounded-lg border border-slate-200 bg-white p-2 text-sm font-medium text-slate-800"
                  />
                  <span className="text-xs text-slate-500">Days</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Simulation Preview Sidecard (Right Pane) */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-4 h-max space-y-4">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
              🔮 Imminent Purge Preview
            </h4>
            <p className="text-[11px] text-amber-800/80 mt-1 leading-relaxed">
              Real-time projection of database indices and binary blocks
              scheduled for extraction based on active sliders.
            </p>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center bg-white border border-amber-100 p-2 rounded-md">
              <span className="text-slate-600">Expired Context Vectors:</span>
              <span className="font-bold text-amber-700">
                {previewData.memoryObjects} records
              </span>
            </div>
            <div className="flex justify-between items-center bg-white border border-amber-100 p-2 rounded-md">
              <span className="text-slate-600">Meeting Record Logs:</span>
              <span className="font-bold text-amber-700">
                {previewData.meetingLogs} streams
              </span>
            </div>
            <div className="flex justify-between items-center bg-white border border-amber-100 p-2 rounded-md">
              <span className="text-slate-600">Binary Attachment Size:</span>
              <span className="font-bold text-amber-700">
                {(previewData.attachmentsBytes / (1024 * 1024)).toFixed(2)} MB
              </span>
            </div>
          </div>
        </div>
      </form>

      {/* Footer Status Message & Interactive Triggers */}
      <div className="border-t border-slate-50 pt-4 flex items-center justify-between">
        <div className="text-xs min-w-0 flex-1">
          {statusMessage && (
            <span
              className={`font-medium ${statusMessage.type === "SUCCESS" ? "text-emerald-600" : "text-rose-600"}`}
            >
              {statusMessage.text}
            </span>
          )}
        </div>

        <button
          type="button"
          disabled={isSaving}
          onClick={handleSavePolicies}
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:bg-slate-400 transition-colors shrink-0"
        >
          {isSaving ? "Syncing Controls..." : "Apply Global Policies"}
        </button>
      </div>
    </div>
  );
};
