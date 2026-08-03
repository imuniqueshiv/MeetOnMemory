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

const DraftRecoveryBanner = ({
  savedAt,
  onRestore,
  onDiscard,
  status,
  lastSavedAt,
}) => {
  if (!savedAt && !lastSavedAt) return null;

  if (savedAt) {
    return (
      <section
        className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950"
        aria-labelledby="meeting-draft-recovery-title"
        aria-live="polite"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 shrink-0" size={20} aria-hidden="true" />
            <div>
              <h3 id="meeting-draft-recovery-title" className="font-semibold">
                Unfinished meeting draft found
              </h3>
              <p className="mt-1 text-sm text-amber-800">
                This draft was saved {formatSavedTime(savedAt)}. Restore it or
                discard it before continuing.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onRestore}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
            >
              <RotateCcw size={16} aria-hidden="true" />
              Restore Draft
            </button>
            <button
              type="button"
              onClick={onDiscard}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
            >
              <Trash2 size={16} aria-hidden="true" />
              Discard
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <p className="mb-4 text-right text-xs text-gray-500" aria-live="polite">
      {status === "saving"
        ? "Saving draft…"
        : `Draft saved ${formatSavedTime(lastSavedAt)}`}
    </p>
  );
};

export default DraftRecoveryBanner;
