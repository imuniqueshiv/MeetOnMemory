import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  ExternalLink,
  Lock,
  Shield,
  Key,
  Download,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { toast } from "react-toastify";
import GlossaryHighlighter from "./GlossaryHighlighter";
import MeetingKeyManager from "./MeetingKeyManager";
import { useMeetingTranscriptText } from "../../hooks/useMeetingTranscriptText.js";
import { loadMeetingKey } from "../../utils/encryption/index.js";
import E2EEKeyManagementModal from "../E2EEKeyManagementModal.jsx";

const MeetingTranscript = ({ meeting }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [encrypting, setEncrypting] = useState(false);
  const [keyVersion, setKeyVersion] = useState(0);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const navigate = useNavigate();
  const {
    plaintext,
    isEncrypted,
    error,
    loading,
    e2eeEnabled,
    encryptAndStore,
  } = useMeetingTranscriptText(meeting, keyVersion);

  if (!meeting) return null;

  const transcript = plaintext || "";
  const hasLegacyPlaintext = Boolean(meeting.transcript);
  const hasEncrypted = Boolean(
    meeting.isTranscriptEncrypted || meeting.encryptedTranscript,
  );
  const hasLocalKey = Boolean(meeting._id && loadMeetingKey(meeting._id));
  const missingKey = hasEncrypted && !hasLocalKey;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(transcript);
      toast.success("Transcript copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleEncrypt = async () => {
    try {
      setEncrypting(true);
      await encryptAndStore(transcript || meeting.transcript);
      toast.success(
        "Transcript encrypted end-to-end. Plaintext cleared on server.",
      );
      // Soft refresh signal — parent pages typically refetch meeting details
      window.dispatchEvent(
        new CustomEvent("meetonmemory:transcript-encrypted", {
          detail: { meetingId: meeting._id },
        }),
      );
    } catch (err) {
      toast.error(err.message || "Failed to encrypt transcript");
    } finally {
      setEncrypting(false);
    }
  };

  const handleKeyImported = () => {
    setKeyVersion((v) => v + 1);
    window.dispatchEvent(
      new CustomEvent("meetonmemory:transcript-encrypted", {
        detail: { meetingId: meeting._id },
      }),
    );
  };

  const shouldShowExpandButton = transcript.length > 1000;

  const truncateAtWord = (text, maxLength) => {
    if (text.length <= maxLength) return text;
    const lastSpace = text.lastIndexOf(" ", maxLength);
    return text.substring(0, lastSpace > 0 ? lastSpace : maxLength) + "...";
  };

  if (!transcript && !hasEncrypted && !loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <FileText size={20} />
          Full Transcript
        </h2>
        <div className="text-gray-500 dark:text-gray-400 text-sm py-8 text-center bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-750">
          <p>No transcript available.</p>
          <p className="text-xs mt-1">Upload audio to generate a transcript.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <FileText size={20} />
          Full Transcript
          {isEncrypted && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-0.5 rounded">
              <Lock size={12} />
              E2EE
            </span>
          )}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {isEncrypted && (
            <button
              type="button"
              onClick={() => setShowKeyModal(true)}
              className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-100 transition"
              title="Export, Import, or Share E2EE Key"
            >
              <Key size={14} />
              Manage E2EE Keys
            </button>
          )}

          {e2eeEnabled && hasLegacyPlaintext && !hasEncrypted && (
            <button
              type="button"
              onClick={handleEncrypt}
              disabled={encrypting}
              className="flex items-center gap-1 text-sm text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300 px-3 py-1 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors disabled:opacity-50"
              title="Encrypt transcript client-side and store ciphertext only"
            >
              <Shield size={14} />
              {encrypting ? "Encrypting…" : "Encrypt (E2EE)"}
            </button>
          )}
          <button
            onClick={() => navigate(`/transcript/${meeting._id}`)}
            className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 px-3 py-1 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
          >
            <ExternalLink size={14} />
            View Full Transcript
          </button>
          {transcript && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white px-3 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Copy
            </button>
          )}
        </div>
      </div>

      {loading && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Decrypting transcript…
        </p>
      )}
      {error && !missingKey && (
        <div className="mb-3 text-sm text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-md p-3">
          {error}
        </div>
      )}

      {error && missingKey && (
        <div className="mb-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{error}</p>
                <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                  Because this transcript is encrypted end-to-end, your browser
                  requires the meeting&apos;s secret key. Ask a meeting attendee
                  or import your backup key to view it.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowKeyModal(true)}
              className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow transition cursor-pointer"
            >
              Import Key
            </button>
          </div>
        </div>
      )}

      {hasEncrypted && (
        <MeetingKeyManager
          meetingId={meeting._id}
          hasLocalKey={hasLocalKey}
          missingKey={missingKey}
          onKeyImported={() => setKeyVersion((v) => v + 1)}
        />
      )}

      {transcript ? (
        <div className="bg-gray-50 dark:bg-gray-900/60 rounded-lg p-4 max-h-96 overflow-y-auto border border-gray-100 dark:border-gray-750">
          <div className="text-gray-700 dark:text-gray-200 text-sm whitespace-pre-wrap leading-relaxed">
            {shouldShowExpandButton && !isExpanded ? (
              <>
                <GlossaryHighlighter text={truncateAtWord(transcript, 1000)} />
                <button
                  onClick={() => setIsExpanded(true)}
                  className="ml-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                >
                  Read more
                </button>
              </>
            ) : (
              <>
                <GlossaryHighlighter text={transcript} />
                {shouldShowExpandButton && (
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="ml-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                  >
                    Show less
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      ) : null}

      <E2EEKeyManagementModal
        isOpen={showKeyModal}
        onClose={() => setShowKeyModal(false)}
        meeting={meeting}
        onKeyImported={handleKeyImported}
      />
    </div>
  );
};

export default MeetingTranscript;
