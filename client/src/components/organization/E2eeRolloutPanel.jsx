import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  KeyRound,
  Cpu,
  Database,
  Server,
  Info,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { checkClientE2eeSupport } from "../../utils/encryption/index.js";

const E2eeRolloutPanel = ({
  e2eeSettings = { enabled: false, enforceOrgWide: false },
  canEdit = false,
  onSave,
}) => {
  const [enabled, setEnabled] = useState(Boolean(e2eeSettings?.enabled));
  const [enforceOrgWide, setEnforceOrgWide] = useState(
    Boolean(e2eeSettings?.enforceOrgWide),
  );
  const [saving, setSaving] = useState(false);
  const [checkingCrypto, setCheckingCrypto] = useState(true);
  const [cryptoCapabilities, setCryptoCapabilities] = useState({
    supported: false,
    hasWebCrypto: false,
    hasAesGcm: false,
    hasLocalStorage: false,
  });

  // Check client browser cryptographic capability on mount
  const runCryptoCheck = useCallback(async () => {
    setCheckingCrypto(true);
    try {
      const caps = await checkClientE2eeSupport();
      setCryptoCapabilities(caps);
    } catch {
      setCryptoCapabilities({
        supported: false,
        hasWebCrypto: false,
        hasAesGcm: false,
        hasLocalStorage: false,
      });
    } finally {
      setCheckingCrypto(false);
    }
  }, []);

  useEffect(() => {
    runCryptoCheck();
  }, [runCryptoCheck]);

  // Sync with prop updates
  useEffect(() => {
    setEnabled(Boolean(e2eeSettings?.enabled));
    setEnforceOrgWide(Boolean(e2eeSettings?.enforceOrgWide));
  }, [e2eeSettings]);

  const isDirty =
    enabled !== Boolean(e2eeSettings?.enabled) ||
    enforceOrgWide !== Boolean(e2eeSettings?.enforceOrgWide);

  const handleToggleEnabled = () => {
    if (!canEdit) return;
    const nextVal = !enabled;
    setEnabled(nextVal);
    if (!nextVal) {
      setEnforceOrgWide(false);
    }
  };

  const handleToggleEnforce = () => {
    if (!canEdit || !enabled) return;
    setEnforceOrgWide(!enforceOrgWide);
  };

  const handleSaveSettings = async () => {
    if (!canEdit || !onSave) return;
    setSaving(true);
    try {
      await onSave({
        enabled,
        enforceOrgWide: enabled ? enforceOrgWide : false,
      });
      toast.success("E2EE settings updated successfully!");
    } catch (err) {
      console.error("Failed to save E2EE settings:", err);
      toast.error(err.message || "Failed to update E2EE settings");
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = () => {
    if (enabled && enforceOrgWide) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" />
          Enforced Org-Wide
        </span>
      );
    }
    if (enabled) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          Enabled (Optional)
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
        <Unlock className="w-3.5 h-3.5" />
        Disabled
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-50 dark:bg-purple-900/30 rounded-xl text-purple-600 dark:text-purple-400">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>End-to-End Encryption (E2EE)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage client-side transcript encryption rollout and org-wide
              privacy rules (#2263)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">{statusBadge()}</div>
      </div>

      {/* Toggles */}
      <div className="space-y-4">
        {/* Toggle 1: Enable E2EE */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Enable E2EE for this Organization</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
              Allows members to generate local AES-GCM 256-bit encryption keys
              and store transcripts as zero-knowledge ciphertext.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={handleToggleEnabled}
              disabled={!canEdit || saving}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-purple-600 peer-disabled:opacity-50" />
          </label>
        </div>

        {/* Toggle 2: Enforce Org-Wide */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            enabled
              ? "bg-slate-50 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-700/60"
              : "bg-slate-100/50 dark:bg-slate-800/20 border-slate-200/40 dark:border-slate-800/40 opacity-60"
          } flex items-start justify-between gap-4`}
        >
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Enforce Org-Wide Encryption</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
              Strictly requires all meeting transcripts created in this
              workspace to be encrypted. Plaintext uploads and captions will be
              rejected.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enforceOrgWide}
              onChange={handleToggleEnforce}
              disabled={!canEdit || !enabled || saving}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600 peer-disabled:opacity-50" />
          </label>
        </div>
      </div>

      {/* Rollout Readiness Checklist */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-700/50 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5" />
            <span>Rollout Readiness Checklist</span>
          </h4>
          <button
            type="button"
            onClick={runCryptoCheck}
            disabled={checkingCrypto}
            className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3 h-3 ${checkingCrypto ? "animate-spin" : ""}`}
            />
            <span>Re-check</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {/* Web Crypto API */}
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 text-xs">
            {cryptoCapabilities.hasWebCrypto ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500 shrink-0" />
            )}
            <span className="text-slate-700 dark:text-slate-300">
              Web Crypto API:{" "}
              <strong
                className={
                  cryptoCapabilities.hasWebCrypto
                    ? "text-emerald-600"
                    : "text-red-500"
                }
              >
                {cryptoCapabilities.hasWebCrypto ? "Available" : "Missing"}
              </strong>
            </span>
          </div>

          {/* AES-GCM 256-bit Cipher */}
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 text-xs">
            {cryptoCapabilities.hasAesGcm ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500 shrink-0" />
            )}
            <span className="text-slate-700 dark:text-slate-300">
              AES-GCM 256 Engine:{" "}
              <strong
                className={
                  cryptoCapabilities.hasAesGcm
                    ? "text-emerald-600"
                    : "text-red-500"
                }
              >
                {cryptoCapabilities.hasAesGcm ? "Supported" : "Unsupported"}
              </strong>
            </span>
          </div>

          {/* Local Storage Key Store */}
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 text-xs">
            {cryptoCapabilities.hasLocalStorage ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500 shrink-0" />
            )}
            <span className="text-slate-700 dark:text-slate-300">
              Browser Key Storage:{" "}
              <strong
                className={
                  cryptoCapabilities.hasLocalStorage
                    ? "text-emerald-600"
                    : "text-red-500"
                }
              >
                {cryptoCapabilities.hasLocalStorage ? "Ready" : "Blocked"}
              </strong>
            </span>
          </div>

          {/* Server Enclave Status */}
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-slate-700 dark:text-slate-300">
              Ciphertext Storage:{" "}
              <strong className="text-emerald-600">Active</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Security Info Banner */}
      <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50 flex items-start gap-2.5 text-xs text-purple-900 dark:text-purple-300">
        <Info className="w-4 h-4 shrink-0 text-purple-600 dark:text-purple-400 mt-0.5" />
        <p>
          <strong>Zero-Knowledge Architecture:</strong> When E2EE is enabled,
          transcript keys are stored only in the participant browsers. The
          server stores AES-GCM ciphertext envelopes and cannot read transcripts
          or run cloud AI pipelines without local decryption.
        </p>
      </div>

      {/* Save Button */}
      {canEdit && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={!isDirty || saving}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-500/20 transition disabled:opacity-40 cursor-pointer flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving E2EE Settings...</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Save E2EE Settings</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default E2eeRolloutPanel;
