import React, { useState } from "react";
import {
  Key,
  Download,
  Upload,
  Share2,
  Copy,
  Check,
  Lock,
  Unlock,
  AlertTriangle,
  FileCode,
  ShieldCheck,
  RefreshCw,
  Eye,
  EyeOff,
  QrCode,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  loadMeetingKey,
  saveMeetingKey,
  importKey,
  exportEncryptedKeyBundle,
  importEncryptedKeyBundle,
  createShareableKeyPayload,
  parseImportedKeyInput,
  decryptTranscript,
} from "../utils/encryption/index.js";

/**
 * E2EEKeyManagementModal (Issue #2030)
 * Provides comprehensive UI for meeting key Export, Import, Share, and Recovery.
 */
const E2EEKeyManagementModal = ({
  isOpen,
  onClose,
  meeting,
  onKeyImported,
}) => {
  const [activeTab, setActiveTab] = useState("export"); // "export" | "import" | "share" | "raw"
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [importInput, setImportInput] = useState("");
  const [importPassphrase, setImportPassphrase] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showRawKey, setShowRawKey] = useState(false);
  const [showQr, setShowQr] = useState(false);

  if (!isOpen || !meeting) return null;

  const meetingId = meeting._id || meeting.id;
  const currentKeyBase64 = loadMeetingKey(meetingId);

  const handleCopy = async (text, label = "Copied to clipboard") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(label);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleDownloadBackup = async () => {
    if (!currentKeyBase64) {
      toast.error("No encryption key found for this meeting in browser.");
      return;
    }
    if (passphrase.length < 6) {
      toast.error(
        "Passphrase must be at least 6 characters to encrypt backup.",
      );
      return;
    }
    if (passphrase !== confirmPassphrase) {
      toast.error("Passphrases do not match.");
      return;
    }

    try {
      setLoading(true);
      const bundle = await exportEncryptedKeyBundle(
        meetingId,
        currentKeyBase64,
        passphrase,
        {
          title: meeting.title || "Meeting",
          date: meeting.date || new Date().toISOString(),
        },
      );

      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meetonmemory-e2ee-key-${meetingId.slice(-6)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Encrypted key backup file downloaded!");
      setPassphrase("");
      setConfirmPassphrase("");
    } catch (err) {
      toast.error(err.message || "Failed to generate key backup");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setImportInput(event.target.result || "");
    };
    reader.readAsText(file);
  };

  const handlePerformImport = async () => {
    if (!importInput.trim()) {
      toast.error("Please paste key/payload or select a backup file.");
      return;
    }

    try {
      setLoading(true);
      const parsed = parseImportedKeyInput(importInput, meetingId);

      let rawKeyToSave = null;
      if (parsed.isBundle) {
        if (!importPassphrase) {
          toast.error(
            "This backup is password protected. Enter the passphrase.",
          );
          setLoading(false);
          return;
        }
        const unlocked = await importEncryptedKeyBundle(
          parsed.bundle,
          importPassphrase,
        );
        rawKeyToSave = unlocked.rawKey;
      } else {
        rawKeyToSave = parsed.key;
      }

      // Verify key by importing to CryptoKey and attempting decryption if ciphertext is available
      const cryptoKey = await importKey(rawKeyToSave);
      const cipherPayload =
        meeting.encryptedTranscript || meeting.encryption?.encryptedTranscript;
      if (cipherPayload) {
        await decryptTranscript(cipherPayload, cryptoKey);
      }

      saveMeetingKey(meetingId, rawKeyToSave, {
        importedAt: new Date().toISOString(),
      });
      toast.success("Meeting key imported and validated successfully!");
      if (onKeyImported) onKeyImported(rawKeyToSave);
      onClose();
    } catch (err) {
      toast.error(err.message || "Failed to import key");
    } finally {
      setLoading(false);
    }
  };

  const sharePayload = currentKeyBase64
    ? createShareableKeyPayload(meetingId, currentKeyBase64, meeting.title)
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-850/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Key size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                E2EE Key Management
                {currentKeyBase64 ? (
                  <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ShieldCheck size={12} /> Key Present
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <AlertTriangle size={12} /> Key Missing
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                {meeting.title || "Meeting Notes"} ({meetingId.slice(-8)})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6 bg-gray-50/30 dark:bg-gray-800/50 text-sm font-medium">
          <button
            onClick={() => setActiveTab("export")}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === "export"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            <Download size={16} /> Export Backup
          </button>
          <button
            onClick={() => setActiveTab("import")}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === "import"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            <Upload size={16} /> Import Key
          </button>
          <button
            onClick={() => setActiveTab("share")}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === "share"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            <Share2 size={16} /> Share Key
          </button>
          <button
            onClick={() => setActiveTab("raw")}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === "raw"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            <FileCode size={16} /> Raw View
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 text-sm">
          {/* Warning Banner */}
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex gap-3 text-amber-900 dark:text-amber-200 text-xs leading-relaxed">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Zero-Knowledge Architecture</p>
              <p className="mt-0.5 text-amber-800 dark:text-amber-300">
                The server only stores ciphertext and cannot recover lost keys.
                Keep a safe backup of this key or share it with authorized
                teammates.
              </p>
            </div>
          </div>

          {/* EXPORT TAB */}
          {activeTab === "export" && (
            <div className="space-y-4">
              {!currentKeyBase64 ? (
                <div className="text-center py-8 space-y-2">
                  <Lock className="w-10 h-10 text-gray-400 mx-auto" />
                  <p className="font-semibold text-gray-700 dark:text-gray-300">
                    No Key Found on This Device
                  </p>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    Please switch to the <strong>Import Key</strong> tab to
                    restore the key from another browser or teammate.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Protect Backup With Passphrase
                    </label>
                    <div className="relative">
                      <input
                        type={showPassphrase ? "text" : "password"}
                        placeholder="Enter password (min 6 characters)"
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-xs pr-10 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassphrase(!showPassphrase)}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                      >
                        {showPassphrase ? (
                          <EyeOff size={14} />
                        ) : (
                          <Eye size={14} />
                        )}
                      </button>
                    </div>
                    <input
                      type={showPassphrase ? "text" : "password"}
                      placeholder="Confirm password"
                      value={confirmPassphrase}
                      onChange={(e) => setConfirmPassphrase(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <button
                    onClick={handleDownloadBackup}
                    disabled={loading || !passphrase}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-sm transition"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download size={16} />
                    )}
                    Download Encrypted Key File (.json)
                  </button>
                </>
              )}
            </div>
          )}

          {/* IMPORT TAB */}
          {activeTab === "import" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Select Backup File or Paste Key / JSON
                </label>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition">
                    <Upload size={14} /> Choose File
                    <input
                      type="file"
                      accept=".json,application/json,text/plain"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  <span className="text-xs text-gray-400">
                    or paste directly below
                  </span>
                </div>
                <textarea
                  rows={4}
                  placeholder="Paste raw base64 key or complete JSON backup..."
                  value={importInput}
                  onChange={(e) => setImportInput(e.target.value)}
                  className="w-full p-3 font-mono text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {importInput.includes("MOM_E2EE_KEY_BUNDLE_V1") && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Backup Passphrase
                  </label>
                  <input
                    type="password"
                    placeholder="Enter the passphrase used during export"
                    value={importPassphrase}
                    onChange={(e) => setImportPassphrase(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              )}

              <button
                onClick={handlePerformImport}
                disabled={loading || !importInput.trim()}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-sm transition"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Unlock size={16} />
                )}
                Import & Unlock Transcript
              </button>
            </div>
          )}

          {/* SHARE TAB */}
          {activeTab === "share" && (
            <div className="space-y-4">
              {!currentKeyBase64 ? (
                <div className="text-center py-6 text-gray-500">
                  <p>Cannot share: key is not present on this device.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Send this formatted payload to an attendee via secure
                    channel (Signal, 1Password, private chat).
                  </p>
                  <div className="relative">
                    <pre className="p-3 bg-gray-900 text-emerald-400 rounded-xl text-xs font-mono overflow-x-auto max-h-48">
                      {sharePayload}
                    </pre>
                    <button
                      onClick={() =>
                        handleCopy(sharePayload, "Share payload copied!")
                      }
                      className="absolute top-2 right-2 px-2.5 py-1 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 border border-gray-700 shadow"
                    >
                      {copied ? (
                        <Check size={12} className="text-emerald-400" />
                      ) : (
                        <Copy size={12} />
                      )}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowQr(!showQr)}
                      className="flex-1 py-2 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-2"
                    >
                      <QrCode size={14} />
                      {showQr ? "Hide QR Code" : "Show QR Code"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(currentKeyBase64, "Raw key copied!")
                      }
                      className="flex-1 py-2 px-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 border border-emerald-200 dark:border-emerald-900/50"
                    >
                      <Copy size={14} />
                      Copy Raw Key
                    </button>
                  </div>

                  {showQr && (
                    <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-center space-y-2">
                      <div className="p-3 bg-white rounded-lg shadow-sm border border-gray-200">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(sharePayload)}`}
                          alt="E2EE Share Payload QR Code"
                          className="w-40 h-40 object-contain mx-auto"
                          loading="lazy"
                        />
                      </div>
                      <p className="text-[11px] text-gray-500">
                        Scan from mobile camera or another MeetOnMemory
                        instance.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* RAW TAB */}
          {activeTab === "raw" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Raw 256-bit AES Base64 Key
                  </label>
                  {currentKeyBase64 && (
                    <button
                      onClick={() => setShowRawKey(!showRawKey)}
                      className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline"
                    >
                      {showRawKey ? <EyeOff size={12} /> : <Eye size={12} />}
                      {showRawKey ? "Mask Key" : "Reveal Key"}
                    </button>
                  )}
                </div>
                {currentKeyBase64 ? (
                  <div className="relative">
                    <input
                      type={showRawKey ? "text" : "password"}
                      readOnly
                      value={currentKeyBase64}
                      className="w-full p-2.5 font-mono text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg pr-16"
                    />
                    <button
                      onClick={() =>
                        handleCopy(currentKeyBase64, "Raw key copied!")
                      }
                      className="absolute right-2 top-2 px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 transition"
                    >
                      Copy
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 italic">
                    No key present in this browser.
                  </p>
                )}
              </div>

              <div className="text-[11px] text-gray-500 space-y-1">
                <p>
                  <strong>Storage Key:</strong> meetonmemory:e2ee:meeting:
                  {meetingId}
                </p>
                <p>
                  <strong>Algorithm:</strong> AES-GCM 256-bit
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-gray-50 dark:bg-gray-850 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs font-semibold rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default E2EEKeyManagementModal;
