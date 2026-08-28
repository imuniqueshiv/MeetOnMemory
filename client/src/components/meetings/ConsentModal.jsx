import React, { useState } from "react";
import {
  Shield,
  AlertTriangle,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Mic,
  Upload,
  Video,
} from "lucide-react";

/**
 * Consent Modal — recording/upload consent gate (Issue #2247)
 *
 * Displays before any media capture (recording, upload, or live room AV).
 * Shows purpose, retention policy pointer, and accept/decline options.
 *
 * Props:
 *   - isOpen: boolean — controls visibility
 *   - onAccept: () => void — called when user accepts consent
 *   - onDecline: () => void — called when user declines consent
 *   - context: "record" | "upload" | "room" — which flow triggered the modal
 *   - organizationName: string — optional org name for context
 *   - isRequired: boolean — whether consent is mandatory (org policy)
 */

const CONSENT_VERSION = "1.0";

const CONTEXT_CONFIG = {
  record: {
    icon: Mic,
    title: "Recording Consent Required",
    description:
      "You are about to start a live audio recording of a meeting.",
    color: "red",
    details: [
      "Your microphone will capture audio during this session.",
      "The recording will be transcribed and processed by AI.",
      "You can stop the recording at any time.",
    ],
  },
  upload: {
    icon: Upload,
    title: "Upload & Transcription Consent Required",
    description:
      "You are about to upload an audio file for transcription.",
    color: "blue",
    details: [
      "The uploaded audio file will be stored securely on our servers.",
      "AI will transcribe the speech and generate meeting minutes.",
      "You can delete the meeting and its data at any time.",
    ],
  },
  room: {
    icon: Video,
    title: "Live Room AV Consent Required",
    description:
      "You are about to join a live meeting with camera and microphone.",
    color: "indigo",
    details: [
      "Your camera and microphone will be active during the session.",
      "Audio/video is streamed peer-to-peer and not stored unless recording is started.",
      "Transcription may be enabled by the meeting host.",
    ],
  },
};

const COLOR_MAP = {
  red: {
    bg: "bg-red-50",
    border: "border-red-100",
    iconBg: "bg-red-100",
    iconText: "text-red-600",
    btnAccept: "bg-red-600 hover:bg-red-700 shadow-red-600/20",
    accent: "text-red-700",
    ring: "ring-red-500/20",
    darkBg: "dark:bg-red-900/20",
    darkBorder: "dark:border-red-800",
  },
  blue: {
    bg: "bg-blue-50",
    border: "border-blue-100",
    iconBg: "bg-blue-100",
    iconText: "text-blue-600",
    btnAccept: "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20",
    accent: "text-blue-700",
    ring: "ring-blue-500/20",
    darkBg: "dark:bg-blue-900/20",
    darkBorder: "dark:border-blue-800",
  },
  indigo: {
    bg: "bg-indigo-50",
    border: "border-indigo-100",
    iconBg: "bg-indigo-100",
    iconText: "text-indigo-600",
    btnAccept: "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20",
    accent: "text-indigo-700",
    ring: "ring-indigo-500/20",
    darkBg: "dark:bg-indigo-900/20",
    darkBorder: "dark:border-indigo-800",
  },
};

const ConsentModal = ({
  isOpen,
  onAccept,
  onDecline,
  context = "record",
  organizationName = "",
  isRequired = true,
}) => {
  const [hasChecked, setHasChecked] = useState(false);
  const config = CONTEXT_CONFIG[context] || CONTEXT_CONFIG.record;
  const colors = COLOR_MAP[config.color] || COLOR_MAP.red;
  const Icon = config.icon;

  if (!isOpen) return null;

  const handleAccept = () => {
    if (!hasChecked) return;
    onAccept?.();
  };

  const handleDecline = () => {
    onDecline?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={isRequired ? undefined : handleDecline}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div
          className={`px-6 py-5 ${colors.bg} ${colors.darkBg} border-b ${colors.border} ${colors.darkBorder}`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`shrink-0 w-12 h-12 ${colors.iconBg} rounded-xl flex items-center justify-center`}
            >
              <Shield className={`w-6 h-6 ${colors.iconText}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {config.title}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                {config.description}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Purpose */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-gray-400" />
              Purpose of Data Collection
            </h3>
            <ul className="space-y-2">
              {config.details.map((detail, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300"
                >
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Data Handling */}
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-gray-400" />
              Data Retention & Handling
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Your recording data will be stored in compliance with applicable
              data protection laws. You can request deletion of your data at any
              time through your account settings. Data is encrypted at rest and
              in transit.{" "}
              {organizationName && (
                <span className="font-medium text-gray-600 dark:text-gray-300">
                  Your organization ({organizationName}) may have additional data
                  retention policies.
                </span>
              )}
            </p>
          </div>

          {/* Legal Notice */}
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                <strong>Legal Notice:</strong> By proceeding, you confirm that
                you have obtained necessary consent from all participants for
                this {context === "room" ? "live session" : "recording"}. Failure
                to obtain required consent may violate applicable recording laws
                in your jurisdiction.
              </p>
            </div>
          </div>

          {/* Consent Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                checked={hasChecked}
                onChange={(e) => setHasChecked(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`w-5 h-5 rounded-md border-2 transition-all duration-150 flex items-center justify-center ${
                  hasChecked
                    ? `${colors.iconBg} border-current ${colors.iconText}`
                    : "border-gray-300 dark:border-gray-600 group-hover:border-gray-400"
                }`}
              >
                {hasChecked && (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
              </div>
            </div>
            <span className="text-sm text-gray-700 dark:text-gray-200 leading-snug">
              I understand and consent to the{" "}
              <strong>
                {context === "record"
                  ? "audio recording"
                  : context === "upload"
                    ? "upload and processing"
                    : "live audio/video capture"}
              </strong>{" "}
              of this meeting, including AI transcription and Minutes of Meeting
              generation. I confirm I have the authority to provide this consent
              and have informed all participants.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
            Consent v{CONSENT_VERSION}
          </span>
          <div className="flex items-center gap-3">
            {!isRequired && (
              <button
                onClick={handleDecline}
                className="px-4 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors rounded-xl"
              >
                Decline
              </button>
            )}
            <button
              onClick={isRequired ? handleDecline : handleDecline}
              className="px-4 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white border border-gray-200 dark:border-gray-600 rounded-xl transition-colors"
            >
              {isRequired ? "Decline & Exit" : "Cancel"}
            </button>
            <button
              onClick={handleAccept}
              disabled={!hasChecked}
              className={`px-6 py-2.5 text-sm font-bold text-white rounded-xl shadow-lg transition-all duration-200 ${
                hasChecked
                  ? `${colors.btnAccept} cursor-pointer`
                  : "bg-gray-300 dark:bg-gray-600 cursor-not-allowed shadow-none"
              }`}
            >
              I Consent & Proceed
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsentModal;
export { CONSENT_VERSION };
