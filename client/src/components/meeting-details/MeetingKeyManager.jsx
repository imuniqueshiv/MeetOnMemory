import React, { useRef, useState } from "react";
import { KeyRound, Upload, Download, AlertTriangle } from "lucide-react";
import { toast } from "react-toastify";
import {
  loadMeetingKey,
  saveMeetingKey,
  exportMeetingKeyBundle,
  importMeetingKeyBundle,
  serializeMeetingKeyBundle,
  parseMeetingKeyBundle,
  meetingKeyBundleFilename,
} from "../../utils/encryption/index.js";

/**
 * Issue #2030 — meeting-key export / import / share UX.
 *
 * Export wraps the browser-local meeting key in a passphrase-protected bundle
 * (safe to email/save), and import restores it on another device so the same
 * encrypted transcript can be decrypted there. When a key is missing this also
 * renders recovery guidance instead of leaving the user at a dead end.
 */
const MeetingKeyManager = ({
  meetingId,
  hasLocalKey,
  onKeyImported,
  missingKey = false,
}) => {
  const [mode, setMode] = useState(missingKey ? "import" : null); // 'export' | 'import' | null
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const [pendingBundle, setPendingBundle] = useState(null);

  const reset = () => {
    setPassphrase("");
    setPendingBundle(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleExport = async () => {
    const base64Key = loadMeetingKey(meetingId);
    if (!base64Key) {
      toast.error("No meeting key is stored in this browser to export.");
      return;
    }
    try {
      setBusy(true);
      const bundle = await exportMeetingKeyBundle(
        base64Key,
        passphrase,
        meetingId,
      );
      const blob = new Blob([serializeMeetingKeyBundle(bundle)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = meetingKeyBundleFilename(meetingId);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(
        "Encrypted key file downloaded. Share the passphrase separately.",
      );
      setMode(null);
      reset();
    } catch (err) {
      toast.error(err.message || "Failed to export key.");
    } finally {
      setBusy(false);
    }
  };

  const handleFilePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setPendingBundle(parseMeetingKeyBundle(await file.text()));
    } catch (err) {
      setPendingBundle(null);
      toast.error(err.message || "Invalid key file.");
    }
  };

  const handleImport = async () => {
    if (!pendingBundle) {
      toast.error("Choose a .momkey file first.");
      return;
    }
    try {
      setBusy(true);
      const { base64Key } = await importMeetingKeyBundle(
        pendingBundle,
        passphrase,
      );
      saveMeetingKey(meetingId, base64Key);
      toast.success("Meeting key imported. Decrypting transcript…");
      setMode(null);
      reset();
      onKeyImported?.();
    } catch (err) {
      toast.error(err.message || "Failed to import key.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      {missingKey && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">
              This transcript is encrypted and the key isn’t on this device.
            </p>
            <p className="mt-1 text-xs">
              Import the meeting key below (a <code>.momkey</code> file + its
              passphrase), or export it from the original device under “Export
              key.” Without the key, the ciphertext cannot be read.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {hasLocalKey && (
          <button
            type="button"
            onClick={() => {
              setMode(mode === "export" ? null : "export");
              reset();
            }}
            className="flex items-center gap-1 rounded-md px-3 py-1 text-sm text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
          >
            <Download size={14} /> Export key
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "import" ? null : "import");
            reset();
          }}
          className="flex items-center gap-1 rounded-md px-3 py-1 text-sm text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
        >
          <Upload size={14} /> Import key
        </button>
      </div>

      {mode === "export" && (
        <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/50">
          <p className="mb-2 flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
            <KeyRound size={12} /> Set a passphrase to protect the exported key.
            Anyone with the file <strong>and</strong> the passphrase can read
            this meeting — share them over separate channels.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Passphrase (min 8 chars)"
              className="flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
            />
            <button
              type="button"
              onClick={handleExport}
              disabled={busy}
              className="rounded-md bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy ? "Exporting…" : "Download key file"}
            </button>
          </div>
        </div>
      )}

      {mode === "import" && (
        <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/50">
          <input
            ref={fileRef}
            type="file"
            accept=".momkey,application/json"
            onChange={handleFilePick}
            className="mb-2 block w-full text-xs text-gray-600 dark:text-gray-400 file:mr-2 file:rounded file:border-0 file:bg-indigo-600 file:px-3 file:py-1 file:text-white"
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Passphrase"
              className="flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
            />
            <button
              type="button"
              onClick={handleImport}
              disabled={busy || !pendingBundle}
              className="rounded-md bg-indigo-600 px-3 py-1 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {busy ? "Importing…" : "Import key"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingKeyManager;
