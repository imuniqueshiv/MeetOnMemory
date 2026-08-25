import React, { useState, useEffect } from "react";
import { ShieldCheck, AlertTriangle, X, Check } from "lucide-react";

export const CONSENT_STORAGE_KEY = "meet_on_memory_recording_consent";

/**
 * Checks if the user has already granted and saved recording consent on this device.
 */
export const hasSavedRecordingConsent = () => {
  try {
    const saved = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!saved) return false;
    const parsed = JSON.parse(saved);
    if (parsed.expiresAt && new Date(parsed.expiresAt) > new Date()) {
      return true;
    }
    localStorage.removeItem(CONSENT_STORAGE_KEY);
    return false;
  } catch {
    return false;
  }
};

/**
 * Saves recording consent into localStorage with a 30-day expiration window.
 */
export const saveRecordingConsent = () => {
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ granted: true, expiresAt: expiresAt.toISOString() }),
    );
  } catch (err) {
    console.warn("Failed to persist recording consent to localStorage", err);
  }
};

const RecordingConsentModal = ({
  isOpen,
  onClose,
  onConfirm,
  actionType = "record", // "record" | "upload" | "live"
}) => {
  const [hasConsented, setHasConsented] = useState(false);
  const [rememberChoice, setRememberChoice] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setHasConsented(false);
      setRememberChoice(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!hasConsented) return;
    if (rememberChoice) {
      saveRecordingConsent();
    }
    onConfirm();
  };

  const getActionDescription = () => {
    switch (actionType) {
      case "upload":
        return "uploading meeting audio or video recordings for AI transcription";
      case "live":
        return "joining or starting live transcription in a meeting room";
      case "record":
      default:
        return "recording in-browser audio for real-time AI transcription";
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Recording and AI Transcription Consent Dialog"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-fade-in-up">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Recording & AI Consent Gate
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Compliance Disclosure & Participant Notification
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close consent dialog"
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice Card */}
        <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 flex gap-3 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Privacy & Wiretapping Law Notice</p>
            <p className="leading-relaxed opacity-90">
              Before {getActionDescription()}, you must notify all participants
              and obtain necessary recording consent under applicable
              wiretapping, data protection (e.g. GDPR, CCPA), and organizational
              policies.
            </p>
          </div>
        </div>

        {/* Checkbox Group */}
        <div className="space-y-3 pt-1">
          <label className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-200 dark:border-slate-700/60 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors select-none">
            <input
              type="checkbox"
              data-testid="consent-mandatory-checkbox"
              checked={hasConsented}
              onChange={(e) => setHasConsented(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-xs font-medium text-gray-800 dark:text-slate-200 leading-normal">
              I confirm all participants have been notified and have given
              explicit consent to be recorded and transcribed with AI.
            </span>
          </label>

          <label className="flex items-center gap-3 px-3 py-1 cursor-pointer select-none text-xs text-gray-600 dark:text-slate-400">
            <input
              type="checkbox"
              data-testid="consent-remember-checkbox"
              checked={rememberChoice}
              onChange={(e) => setRememberChoice(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span>Remember my confirmation on this device (30 days)</span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-3 border-t border-gray-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="consent-confirm-proceed-button"
            onClick={handleConfirm}
            disabled={!hasConsented}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-md disabled:cursor-not-allowed transition-all"
          >
            <Check className="w-3.5 h-3.5" />I Agree & Proceed
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecordingConsentModal;
