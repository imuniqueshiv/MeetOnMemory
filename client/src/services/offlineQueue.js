// client/src/services/offlineQueue.js

const DB_NAME = "offline-mutations-db";
const STORE_NAME = "mutations";
const DB_VERSION = 1;

const listeners = new Set();
let isReplaying = false;

/**
 * Open the IndexedDB database for offline mutations.
 */
export const openDB = () => {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      return reject(
        new Error("IndexedDB is not supported in this environment"),
      );
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
};

/**
 * Notify all subscribers of queue updates.
 */
export const notifyQueueListeners = async () => {
  try {
    const queue = await getQueuedMutations();
    listeners.forEach((callback) => {
      try {
        callback(queue);
      } catch (err) {
        console.error("[Offline Queue] Error in listener callback:", err);
      }
    });

    if (
      typeof window !== "undefined" &&
      typeof window.dispatchEvent === "function"
    ) {
      window.dispatchEvent(
        new CustomEvent("offline-queue-changed", {
          detail: { queue, count: queue.length },
        }),
      );
    }
  } catch (err) {
    console.error("[Offline Queue] Failed to notify listeners:", err);
  }
};

/**
 * Subscribe to queue changes.
 * @param {Function} callback Callback receiving the current list of mutations.
 * @returns {Function} Unsubscribe function.
 */
export const subscribeQueue = (callback) => {
  listeners.add(callback);
  // Emit initial state
  getQueuedMutations()
    .then((queue) => callback(queue))
    .catch(() => callback([]));

  return () => {
    listeners.delete(callback);
  };
};

/**
 * Queue a mutation to IndexedDB.
 * @param {Object} mutation { url, method, headers, body, idempotencyKey }
 */
export const queueMutation = async (mutation) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const item = {
      ...mutation,
      idempotencyKey:
        mutation.idempotencyKey ||
        `off-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      status: "queued",
      error: null,
    };
    const request = store.add(item);

    request.onsuccess = () => {
      const insertedId = request.result;

      // Register for background sync if service worker is active
      if (
        typeof navigator !== "undefined" &&
        "serviceWorker" in navigator &&
        "sync" in (navigator.serviceWorker.controller || {})
      ) {
        navigator.serviceWorker.ready
          .then((reg) => reg.sync.register("sync-mutations"))
          .catch((err) => {
            console.warn(
              "[Offline Queue] Failed to register background sync:",
              err,
            );
          });
      }

      notifyQueueListeners();
      resolve(insertedId);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
};

/**
 * Get a single mutation by ID.
 * @param {number|string} id
 */
export const getMutation = async (id) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result || null);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
};

/**
 * Get all queued mutations.
 */
export const getQueuedMutations = async () => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
};

/**
 * Delete a mutation from the queue.
 */
export const dequeueMutation = async (id) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      notifyQueueListeners();
      resolve();
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
};

/**
 * Update mutation status.
 */
export const updateMutationStatus = async (id, status, errorMsg = null) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const data = getRequest.result;
      if (data) {
        data.status = status;
        data.error = errorMsg;
        const updateRequest = store.put(data);
        updateRequest.onsuccess = () => {
          notifyQueueListeners();
          resolve();
        };
        updateRequest.onerror = (event) => reject(event.target.error);
      } else {
        resolve();
      }
    };

    getRequest.onerror = (event) => {
      reject(event.target.error);
    };
  });
};

/**
 * Clear all queued mutations.
 */
export const clearQueue = async () => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear ? store.clear() : store.getAll();

    if (store.clear) {
      request.onsuccess = () => {
        notifyQueueListeners();
        resolve();
      };
      request.onerror = (event) => reject(event.target.error);
    } else {
      // Fallback if clear is not present in mock
      request.onsuccess = () => {
        const items = request.result || [];
        const deleteTransaction = db.transaction(STORE_NAME, "readwrite");
        const deleteStore = deleteTransaction.objectStore(STORE_NAME);
        items.forEach((item) => deleteStore.delete(item.id));
        deleteTransaction.oncomplete = () => {
          notifyQueueListeners();
          resolve();
        };
        deleteTransaction.onerror = (event) => reject(event.target.error);
      };
      request.onerror = (event) => reject(event.target.error);
    }
  });
};

/**
 * Replay an individual queued mutation.
 * @param {number|string} id
 * @returns {Promise<{success: boolean, id: any, error?: string}>}
 */
export const replayMutation = async (id) => {
  const item = await getMutation(id);
  if (!item) {
    return { success: false, id, error: "Mutation not found in queue" };
  }

  await updateMutationStatus(id, "syncing");

  try {
    const headers = {
      "Content-Type": "application/json",
      ...(item.headers || {}),
      "X-Idempotency-Key": item.idempotencyKey || `off-${item.id}`,
    };

    // Clean up Axios internal headers
    delete headers["common"];
    delete headers["delete"];
    delete headers["get"];
    delete headers["head"];
    delete headers["post"];
    delete headers["put"];
    delete headers["patch"];

    let body = item.body;
    if (
      body &&
      typeof body === "object" &&
      !(body instanceof FormData) &&
      !(body instanceof Blob)
    ) {
      body = JSON.stringify(body);
    }

    const response = await fetch(item.url, {
      method: (item.method || "POST").toUpperCase(),
      headers,
      body: ["GET", "HEAD"].includes((item.method || "").toUpperCase())
        ? undefined
        : body,
      credentials: "include",
    });

    if (response.ok || response.status === 409) {
      // 2xx or 409 conflict already satisfied
      await dequeueMutation(id);
      return { success: true, id };
    }

    let errorText = `Server responded with ${response.status}`;
    try {
      const errJson = await response.json();
      errorText = errJson.message || errJson.error || errorText;
    } catch {
      // Ignore json parse error
    }

    await updateMutationStatus(id, "failed", errorText);
    return { success: false, id, error: errorText };
  } catch (networkErr) {
    const errMsg = networkErr?.message || "Network request failed";
    await updateMutationStatus(id, "failed", errMsg);
    return { success: false, id, error: errMsg };
  }
};

/**
 * Replay all pending offline mutations in order.
 * @param {Object} options
 * @param {Function} [options.onProgress] Callback receiving ({ current, total, item, succeeded, failed })
 * @returns {Promise<{total: number, succeeded: number, failed: number}>}
 */
export const replayQueuedMutations = async ({ onProgress } = {}) => {
  if (isReplaying) {
    return { total: 0, succeeded: 0, failed: 0, alreadyRunning: true };
  }

  isReplaying = true;

  try {
    if (
      typeof window !== "undefined" &&
      typeof window.dispatchEvent === "function"
    ) {
      window.dispatchEvent(new CustomEvent("offline-sync-start"));
    }

    const queue = await getQueuedMutations();
    const total = queue.length;
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < total; i++) {
      const item = queue[i];
      if (onProgress) {
        onProgress({
          current: i + 1,
          total,
          item,
          succeeded,
          failed,
        });
      }

      const result = await replayMutation(item.id);
      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }

      if (
        typeof window !== "undefined" &&
        typeof window.dispatchEvent === "function"
      ) {
        window.dispatchEvent(
          new CustomEvent("offline-sync-progress", {
            detail: {
              current: i + 1,
              total,
              succeeded,
              failed,
            },
          }),
        );
      }
    }

    if (
      typeof window !== "undefined" &&
      typeof window.dispatchEvent === "function"
    ) {
      window.dispatchEvent(
        new CustomEvent("offline-sync-complete", {
          detail: { total, succeeded, failed },
        }),
      );
    }

    return { total, succeeded, failed };
  } finally {
    isReplaying = false;
  }
};

/**
 * Check if a replay process is actively running.
 */
export const isReplayActive = () => isReplaying;

// Setup automated reconnection replay listener
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    console.log(
      "[Offline Queue] Connection restored. Replaying queued mutations...",
    );
    replayQueuedMutations().catch((err) => {
      console.warn("[Offline Queue] Reconnection replay failed:", err);
    });
  });
}
