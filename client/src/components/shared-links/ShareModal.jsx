import React, { useState, useEffect, useId, useRef } from "react";
import {
  Copy,
  Trash2,
  X,
  Plus,
  Calendar,
  Lock,
  Globe,
  Eye,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { toast } from "react-toastify";
import { sharedLinkApi } from "../../services";
import RoleGate from "../RoleGate.jsx";

const formatLastAccessed = (value) => {
  if (!value) return "Never";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "Never";
  }
};

const LinkAnalytics = ({ link }) => {
  const views = link.totalViews ?? 0;
  const failedAttempts = link.failedPasscodeAttempts ?? 0;
  const hasActivity =
    views > 0 || failedAttempts > 0 || Boolean(link.lastAccessed);

  if (!hasActivity) {
    return (
      <p
        className="mt-2 text-xs text-gray-500 dark:text-gray-400"
        data-testid="shared-link-analytics-empty"
      >
        No access activity yet
      </p>
    );
  }

  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-300"
      data-testid="shared-link-analytics"
    >
      <span className="inline-flex items-center gap-1">
        <Eye className="w-3 h-3" aria-hidden="true" />
        {views} {views === 1 ? "view" : "views"}
      </span>
      <span className="inline-flex items-center gap-1">
        <Clock className="w-3 h-3" aria-hidden="true" />
        Last: {formatLastAccessed(link.lastAccessed)}
      </span>
      {failedAttempts > 0 && (
        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-3 h-3" aria-hidden="true" />
          {failedAttempts} failed passcode
          {failedAttempts === 1 ? " attempt" : " attempts"}
        </span>
      )}
    </div>
  );
};

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const ShareModal = ({ isOpen, onClose, resourceId, resourceType, title }) => {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // New link form state
  const [showForm, setShowForm] = useState(false);
  const [expirationDate, setExpirationDate] = useState("");
  const [passcode, setPasscode] = useState("");
  const [shareSettings, setShareSettings] = useState({
    includeTranscript: false,
    includeAttachments: false,
    includeClips: false,
    redactPii: true,
    redactParticipantNames: false,
  });
  const titleId = useId();
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      fetchLinks();
      setShowForm(false);
      setExpirationDate("");
      setPasscode("");
      setShareSettings({
        includeTranscript: false,
        includeAttachments: false,
        includeClips: false,
        redactPii: true,
        redactParticipantNames: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, resourceId]);

  // Move focus into the dialog on open; restore it on close
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement;
    const frame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      const previous = previouslyFocusedRef.current;
      if (previous && typeof previous.focus === "function") {
        previous.focus();
      }
    };
  }, [isOpen]);

  // Escape dismissal + Tab focus trap for keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (showForm) {
          setShowForm(false);
          setExpirationDate("");
          setPasscode("");
          closeButtonRef.current?.focus();
        } else {
          onClose();
        }
        return;
      }

      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR),
      ).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, showForm]);

  const fetchLinks = async () => {
    try {
      setLoading(true);
      const { data } = await sharedLinkApi.getActiveLinks(
        resourceType,
        resourceId,
      );
      if (data.success) {
        setLinks(data.links);
      }
    } catch (err) {
      toast.error("Failed to load shared links");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLink = async (e) => {
    e.preventDefault();
    try {
      setGenerating(true);
      const payload = {
        resourceId,
        resourceType,
        expirationDate: expirationDate || null,
        passcode: passcode || null,
        ...(resourceType === "Meeting" ? { shareSettings } : {}),
      };
      const { data } = await sharedLinkApi.createLink(payload);
      if (data.success) {
        toast.success("Link generated successfully");
        setLinks([data.link, ...links]);
        setShowForm(false);
        setExpirationDate("");
        setPasscode("");
      }
    } catch (err) {
      toast.error("Failed to generate link");
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (id) => {
    try {
      const { data } = await sharedLinkApi.revokeLink(id);
      if (data.success) {
        toast.success("Link revoked");
        setLinks(links.filter((link) => link._id !== id));
      }
    } catch (err) {
      toast.error("Failed to revoke link");
      console.error(err);
    }
  };

  const handleCopy = (hash) => {
    const url = `${window.location.origin}/shared/${hash}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        ></div>
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">
          &#8203;
        </span>

        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full"
        >
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h3
              id={titleId}
              className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2"
            >
              <Globe className="w-5 h-5 text-indigo-500" aria-hidden="true" />
              Share {title}
            </h3>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close share modal"
              className="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <div className="p-6">
            {!showForm ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Active Links
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" /> New Link
                  </button>
                </div>

                {loading ? (
                  <div
                    className="animate-pulse space-y-3"
                    data-testid="shared-links-loading"
                  >
                    <div className="h-16 bg-gray-100 dark:bg-gray-700 rounded"></div>
                    <div className="h-16 bg-gray-100 dark:bg-gray-700 rounded"></div>
                  </div>
                ) : links.length === 0 ? (
                  <div
                    className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm"
                    data-testid="shared-links-empty"
                  >
                    No active shared links. Create one to share this resource
                    externally.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
                    {links.map((link) => (
                      <div
                        key={link._id}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex justify-between items-start bg-gray-50 dark:bg-gray-900"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {window.location.origin}/shared/{link.hash}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                            {link.expirationDate ? (
                              <span className="flex items-center gap-1">
                                <Calendar
                                  className="w-3 h-3"
                                  aria-hidden="true"
                                />
                                Expires:{" "}
                                {new Date(
                                  link.expirationDate,
                                ).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Calendar
                                  className="w-3 h-3"
                                  aria-hidden="true"
                                />{" "}
                                Never expires
                              </span>
                            )}
                            {link.hasPasscode && (
                              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                <Lock className="w-3 h-3" aria-hidden="true" />{" "}
                                Password protected
                              </span>
                            )}
                          </div>
                          <RoleGate
                            resource={
                              resourceType === "Policy"
                                ? "policies"
                                : "meetings"
                            }
                            action="edit"
                          >
                            {"totalViews" in link ||
                            "failedPasscodeAttempts" in link ||
                            "lastAccessed" in link ? (
                              <LinkAnalytics link={link} />
                            ) : null}
                          </RoleGate>
                        </div>
                        <div className="ml-4 flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopy(link.hash)}
                            className="p-1.5 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 bg-white dark:bg-gray-800 rounded shadow-sm border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            title="Copy link"
                            aria-label="Copy link"
                          >
                            <Copy className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevoke(link._id)}
                            className="p-1.5 text-red-500 hover:text-red-700 bg-white dark:bg-gray-800 rounded shadow-sm border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            title="Revoke link"
                            aria-label="Revoke link"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleCreateLink} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Expiration Date (Optional)
                  </label>
                  <input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    autoFocus
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Passcode (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Set a password to restrict access"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                {resourceType === "Meeting" && (
                  <fieldset className="space-y-2 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                    <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 px-1">
                      Include in public view
                    </legend>
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={shareSettings.includeTranscript}
                        onChange={(e) =>
                          setShareSettings({
                            ...shareSettings,
                            includeTranscript: e.target.checked,
                          })
                        }
                      />
                      Transcript excerpt
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={shareSettings.includeAttachments}
                        onChange={(e) =>
                          setShareSettings({
                            ...shareSettings,
                            includeAttachments: e.target.checked,
                          })
                        }
                      />
                      Attachment metadata
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={shareSettings.includeClips}
                        onChange={(e) =>
                          setShareSettings({
                            ...shareSettings,
                            includeClips: e.target.checked,
                          })
                        }
                      />
                      Meeting clips
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={shareSettings.redactPii}
                        onChange={(e) =>
                          setShareSettings({
                            ...shareSettings,
                            redactPii: e.target.checked,
                          })
                        }
                      />
                      Redact sensitive fields (PII)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={shareSettings.redactParticipantNames}
                        onChange={(e) =>
                          setShareSettings({
                            ...shareSettings,
                            redactParticipantNames: e.target.checked,
                          })
                        }
                      />
                      Hide participant/speaker names
                    </label>
                  </fieldset>
                )}
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={generating}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {generating ? "Generating..." : "Generate Link"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
