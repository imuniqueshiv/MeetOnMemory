import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  Copy,
  Link2,
  Loader2,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import { meetingApi } from "../../services";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const MeetingInviteModal = ({ isOpen, onClose, meetingId, title }) => {
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const titleId = useId();
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  const inviteUrl = invite?.code
    ? `${window.location.origin}/meeting-invite/${invite.code}`
    : "";

  const loadInvite = useCallback(async () => {
    if (!meetingId) return;
    setLoading(true);
    try {
      const res = await meetingApi.getInvite(meetingId);
      const next = res.data?.invite;
      setInvite(next || null);
      setExpiresAt(
        next?.expiresAt
          ? new Date(next.expiresAt).toISOString().slice(0, 16)
          : "",
      );
    } catch (err) {
      console.error(err);
      toast.error(
        err.response?.data?.message || "Could not load meeting invite.",
      );
      setInvite(null);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    if (isOpen) loadInvite();
  }, [isOpen, loadInvite]);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement;
    const frame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [
        ...dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR),
      ];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

  const copyLink = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Invite link copied.");
    } catch {
      toast.error("Could not copy invite link.");
    }
  };

  const regenerate = async () => {
    setBusy(true);
    try {
      const res = await meetingApi.regenerateInvite(meetingId);
      setInvite(res.data?.invite || null);
      toast.success("Invite link regenerated. Old links no longer work.");
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Could not regenerate invite link.",
      );
    } finally {
      setBusy(false);
    }
  };

  const toggleEnabled = async () => {
    if (!invite) return;
    setBusy(true);
    try {
      const res = await meetingApi.updateInvite(meetingId, {
        enabled: !invite.enabled,
      });
      setInvite(res.data?.invite || null);
      toast.success(
        res.data?.invite?.enabled
          ? "Invite link enabled."
          : "Invite link disabled.",
      );
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Could not update invite link.",
      );
    } finally {
      setBusy(false);
    }
  };

  const saveExpiration = async () => {
    setBusy(true);
    try {
      const res = await meetingApi.updateInvite(meetingId, {
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      setInvite(res.data?.invite || null);
      toast.success("Invite expiration updated.");
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Could not update expiration.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg rounded-2xl bg-white shadow-xl dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2
              id={titleId}
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              Share Invite
            </h2>
            <p className="mt-1 text-sm text-slate-500 truncate">
              {title || "Meeting"}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close invite dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing invite link...
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/50">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Link2 className="h-3.5 w-3.5" />
                  Invite link
                </div>
                <p className="break-all font-mono text-sm text-slate-800 dark:text-slate-200">
                  {inviteUrl || "Unavailable"}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Code:{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {invite?.code || "—"}
                  </span>
                  {" · "}
                  {invite?.enabled ? "Enabled" : "Disabled"}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={copyLink}
                  disabled={!inviteUrl || busy}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Copy className="h-4 w-4" />
                  Copy link
                </button>
                <button
                  type="button"
                  onClick={regenerate}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  Regenerate
                </button>
                <button
                  type="button"
                  onClick={toggleEnabled}
                  disabled={busy || !invite}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  {invite?.enabled ? (
                    <ToggleRight className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <ToggleLeft className="h-4 w-4 text-slate-400" />
                  )}
                  {invite?.enabled ? "Disable" : "Enable"}
                </button>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="meeting-invite-expires"
                  className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Expiration (optional)
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="meeting-invite-expires"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                  <button
                    type="button"
                    onClick={saveExpiration}
                    disabled={busy}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Clear the date and save to remove expiration.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeetingInviteModal;
