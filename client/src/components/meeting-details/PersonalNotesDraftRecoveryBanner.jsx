import React from "react";
import { Clock3, RotateCcw, Trash2 } from "lucide-react";

const formatSavedTime = (savedAt) => {
  if (!savedAt) return "recently";

  const savedDate = new Date(savedAt);
  if (Number.isNaN(savedDate.getTime())) return "recently";

  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - savedDate.getTime()) / 60000),
  );

  if (elapsedMinutes < 1) return "just now";
  if (elapsedMinutes < 60)
    return `${elapsedMinutes} minute${elapsedMinutes === 1 ? "" : "s"} ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours} hour${elapsedHours === 1 ? "" : "s"} ago`;
  }

  return savedDate.toLocaleString();
};

const PersonalNotesDraftRecoveryBanner = ({
  savedAt,
  onRestore,
  onDiscard,
}) => {
  if (!savedAt) return null;

  return (
    <section
      className="mb-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 p-4 text-amber-950 dark:text-amber-100"
      aria-labelledby="notes-draft-recovery-title"
      aria-live="polite"
      data-testid="notes-draft-recovery-banner"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Clock3
            className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
            size={20}
            aria-hidden="true"
          />
          <div>
            <h3
              id="notes-draft-recovery-title"
              className="font-semibold text-sm"
            >
              Unsaved personal notes draft found
            </h3>
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
              This draft was saved locally {formatSavedTime(savedAt)}. Restore
              it to continue editing or discard it.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRestore}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700 cursor-pointer"
            data-testid="restore-draft-btn"
          >
            <RotateCcw size={14} aria-hidden="true" />
            Restore Draft
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200 transition hover:bg-amber-100 dark:hover:bg-gray-700 cursor-pointer"
            data-testid="discard-draft-btn"
          >
            <Trash2 size={14} aria-hidden="true" />
            Discard
          </button>
        </div>
      </div>
    </section>
  );
};

export default PersonalNotesDraftRecoveryBanner;
