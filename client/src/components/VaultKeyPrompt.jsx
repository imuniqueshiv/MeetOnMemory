import React, { useState, useEffect } from "react";
import { Lock, KeyRound, Loader2 } from "lucide-react";
import { deriveKeyFromPassword, saveKeyToSession, getKeyFromSession } from "../utils/cryptoUtils";

const VaultKeyPrompt = ({ onKeyReady }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [isDeriving, setIsDeriving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const checkKey = async () => {
      const key = await getKeyFromSession();
      if (key) {
        onKeyReady(key);
      } else {
        setIsOpen(true);
      }
    };
    checkKey();
  }, [onKeyReady]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Password cannot be empty.");
      return;
    }

    try {
      setIsDeriving(true);
      setError("");
      // Derive key and save it to sessionStorage
      const key = await deriveKeyFromPassword(password);
      await saveKeyToSession(key);
      setIsOpen(false);
      onKeyReady(key);
    } catch (err) {
      console.error(err);
      setError("Failed to set up encryption key.");
    } finally {
      setIsDeriving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-8 animate-fade-in-up border border-gray-100 dark:border-gray-700">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center border-4 border-white dark:border-gray-800 shadow-md">
            <Lock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white text-center mb-2">
          End-to-End Encryption
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-center text-sm mb-8">
          Enter a secure Vault Password. This password will be used to encrypt your meeting transcripts and summaries locally on your device. Ensure you remember it, as it cannot be recovered.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Vault Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <KeyRound className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 text-gray-900 dark:text-white transition-all outline-none"
                placeholder="Enter a strong password"
                required
              />
            </div>
            {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={isDeriving}
            className="w-full py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-blue-500/30 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/50 transition-all duration-200 flex justify-center items-center"
          >
            {isDeriving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Securing Vault...
              </>
            ) : (
              "Unlock Vault"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default VaultKeyPrompt;
