import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DRAFT_VERSION = 1;
const DEFAULT_DEBOUNCE_MS = 700;
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const safeParseDraft = (rawValue) => {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue);
    if (
      !parsed ||
      parsed.version !== DRAFT_VERSION ||
      typeof parsed.savedAt !== "string" ||
      !parsed.values ||
      typeof parsed.values !== "object"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

const isDraftExpired = (draft, maxAgeMs, now) => {
  const savedAt = Date.parse(draft.savedAt);
  return !Number.isFinite(savedAt) || now - savedAt > maxAgeMs;
};

const isDraftOlderThanServer = (draft, serverUpdatedAt) => {
  if (!serverUpdatedAt) return false;

  const draftSavedAt = Date.parse(draft.savedAt);
  const serverTimestamp = Date.parse(serverUpdatedAt);

  return (
    Number.isFinite(draftSavedAt) &&
    Number.isFinite(serverTimestamp) &&
    draftSavedAt <= serverTimestamp
  );
};

export const buildMeetingDraftKey = ({
  userId,
  organizationId,
  mode = "create",
  meetingId,
}) => {
  if (!userId || !organizationId) return null;

  const scope = mode === "edit" ? meetingId || "unknown-meeting" : "new";
  return `meet-on-memory:meeting-draft:v${DRAFT_VERSION}:${userId}:${organizationId}:${mode}:${scope}`;
};

export const useFormDraft = ({
  key,
  values,
  enabled = true,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  maxAgeMs = DEFAULT_MAX_AGE_MS,
  serverUpdatedAt = null,
  onRestore,
}) => {
  const [recoverableDraft, setRecoverableDraft] = useState(null);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [status, setStatus] = useState("idle");
  const [isCheckComplete, setIsCheckComplete] = useState(false);
  const hasInspectedStorage = useRef(false);
  const hasDraftRef = useRef(false);
  const skipNextSave = useRef(false);

  const storageAvailable = useMemo(
    () => typeof window !== "undefined" && Boolean(window.localStorage),
    [],
  );

  const removeStoredDraft = useCallback(() => {
    if (!storageAvailable || !key) return;
    window.localStorage.removeItem(key);
  }, [key, storageAvailable]);

  const discardDraft = useCallback(() => {
    removeStoredDraft();
    setRecoverableDraft(null);
    setLastSavedAt(null);
    setStatus("discarded");
  }, [removeStoredDraft]);

  const clearDraft = useCallback(() => {
    removeStoredDraft();
    setRecoverableDraft(null);
    setLastSavedAt(null);
    setStatus("idle");
  }, [removeStoredDraft]);

  const restoreDraft = useCallback(() => {
    if (!recoverableDraft) return false;

    skipNextSave.current = true;
    onRestore?.(recoverableDraft.values);
    setLastSavedAt(recoverableDraft.savedAt);
    setRecoverableDraft(null);
    setStatus("restored");
    return true;
  }, [onRestore, recoverableDraft]);

  useEffect(() => {
    hasInspectedStorage.current = false;
    hasDraftRef.current = false;
    setRecoverableDraft(null);
    setLastSavedAt(null);
    setStatus("idle");
    setIsCheckComplete(false);

    if (!enabled || !storageAvailable || !key) return;

    const rawDraft = window.localStorage.getItem(key);
    const draft = safeParseDraft(rawDraft);
    hasInspectedStorage.current = true;

    if (!draft) {
      if (rawDraft) window.localStorage.removeItem(key);
      skipNextSave.current = true;
      setIsCheckComplete(true);
      return;
    }

    if (
      isDraftExpired(draft, maxAgeMs, Date.now()) ||
      isDraftOlderThanServer(draft, serverUpdatedAt)
    ) {
      window.localStorage.removeItem(key);
      setStatus("expired");
      skipNextSave.current = true;
      setIsCheckComplete(true);
      return;
    }

    hasDraftRef.current = true;
    setRecoverableDraft(draft);
    setLastSavedAt(draft.savedAt);
    setStatus("recovery-available");
    setIsCheckComplete(true);
  }, [enabled, key, maxAgeMs, serverUpdatedAt, storageAvailable]);

  useEffect(() => {
    if (
      !enabled ||
      !storageAvailable ||
      !key ||
      !hasInspectedStorage.current ||
      hasDraftRef.current ||
      recoverableDraft
    ) {
      return undefined;
    }

    if (skipNextSave.current) {
      skipNextSave.current = false;
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setStatus("saving");
      const savedAt = new Date().toISOString();
      const draft = {
        version: DRAFT_VERSION,
        savedAt,
        values,
      };

      try {
        window.localStorage.setItem(key, JSON.stringify(draft));
        setLastSavedAt(savedAt);
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    }, debounceMs);

    return () => window.clearTimeout(timeoutId);
  }, [debounceMs, enabled, key, recoverableDraft, storageAvailable, values]);

  return {
    recoverableDraft,
    lastSavedAt,
    status,
    isCheckComplete,
    restoreDraft,
    discardDraft,
    clearDraft,
  };
};
