import React, { useState, useEffect } from "react";
import { Copy, Trash2, X, Plus, Calendar, Lock, Globe } from "lucide-react";
import { toast } from "react-toastify";
import { sharedLinkApi } from "../../services";

const ShareModal = ({ isOpen, onClose, resourceId, resourceType, title }) => {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // New link form state
  const [showForm, setShowForm] = useState(false);
  const [expirationDate, setExpirationDate] = useState("");
  const [passcode, setPasscode] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchLinks();
      setShowForm(false);
      setExpirationDate("");
      setPasscode("");
    }
  }, [isOpen, resourceId]);

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
        ></div>
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">
          &#8203;
        </span>

        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-500" />
              Share {title}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="w-5 h-5" />
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
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                  >
                    <Plus className="w-4 h-4" /> New Link
                  </button>
                </div>

                {loading ? (
                  <div className="animate-pulse space-y-3">
                    <div className="h-12 bg-gray-100 dark:bg-gray-700 rounded"></div>
                    <div className="h-12 bg-gray-100 dark:bg-gray-700 rounded"></div>
                  </div>
                ) : links.length === 0 ? (
                  <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
                    No active shared links. Create one to share this resource
                    externally.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                    {links.map((link) => (
                      <div
                        key={link._id}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex justify-between items-center bg-gray-50 dark:bg-gray-900"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {window.location.origin}/shared/{link.hash}
                          </p>
                          <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                            {link.expirationDate ? (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Expires:{" "}
                                {new Date(
                                  link.expirationDate,
                                ).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> Never expires
                              </span>
                            )}
                            {link.hasPasscode && (
                              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                <Lock className="w-3 h-3" /> Password protected
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="ml-4 flex items-center gap-2">
                          <button
                            onClick={() => handleCopy(link.hash)}
                            className="p-1.5 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 bg-white dark:bg-gray-800 rounded shadow-sm border border-gray-200 dark:border-gray-700"
                            title="Copy link"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRevoke(link._id)}
                            className="p-1.5 text-red-500 hover:text-red-700 bg-white dark:bg-gray-800 rounded shadow-sm border border-gray-200 dark:border-gray-700"
                            title="Revoke link"
                          >
                            <Trash2 className="w-4 h-4" />
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
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
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
