import { describe, it, expect, vi, beforeEach } from "vitest";
import apiClient from "../apiClient.js";

// Mock indexedDB completely
let dbStore = {};
const mockDb = {
  transaction: () => ({
    objectStore: () => ({
      add: (item) => {
        const id = Math.random().toString(36).substring(2, 9);
        const record = { ...item, id };
        dbStore[id] = record;
        const req = { onsuccess: null, onerror: null, result: id };
        setTimeout(() => req.onsuccess && req.onsuccess(), 0);
        return req;
      },
      getAll: () => {
        const req = {
          onsuccess: null,
          onerror: null,
          result: Object.values(dbStore),
        };
        setTimeout(() => req.onsuccess && req.onsuccess(), 0);
        return req;
      },
      delete: (id) => {
        delete dbStore[id];
        const req = { onsuccess: null, onerror: null };
        setTimeout(() => req.onsuccess && req.onsuccess(), 0);
        return req;
      },
      get: (id) => {
        const req = { onsuccess: null, onerror: null, result: dbStore[id] };
        setTimeout(() => req.onsuccess && req.onsuccess(), 0);
        return req;
      },
      put: (item) => {
        dbStore[item.id] = item;
        const req = { onsuccess: null, onerror: null, result: item.id };
        setTimeout(() => req.onsuccess && req.onsuccess(), 0);
        return req;
      },
      clear: () => {
        dbStore = {};
        const req = { onsuccess: null, onerror: null };
        setTimeout(() => req.onsuccess && req.onsuccess(), 0);
        return req;
      },
    }),
  }),
};

globalThis.indexedDB = {
  open: () => {
    const req = { onsuccess: null, onerror: null, onupgradeneeded: null };
    setTimeout(() => {
      req.onsuccess({ target: { result: mockDb } });
    }, 0);
    return req;
  },
};

describe("Offline Mutation Queue & Background Sync Tests (#1902)", () => {
  beforeEach(async () => {
    dbStore = {};
    vi.clearAllMocks();
  });

  it("queues mutations and reads them from IndexedDB successfully", async () => {
    const { queueMutation, getQueuedMutations } =
      await import("../offlineQueue.js");

    const mutationId = await queueMutation({
      url: "https://api.test/mutate",
      method: "POST",
      body: { data: "test-content" },
    });

    expect(mutationId).toBeDefined();

    const queued = await getQueuedMutations();
    expect(queued.length).toBe(1);
    expect(queued[0].url).toBe("https://api.test/mutate");
    expect(queued[0].status).toBe("queued");
  });

  it("updates and deletes queued mutations correctly", async () => {
    const {
      queueMutation,
      updateMutationStatus,
      dequeueMutation,
      getQueuedMutations,
    } = await import("../offlineQueue.js");

    const id = await queueMutation({
      url: "https://api.test/mutate",
      method: "POST",
    });

    await updateMutationStatus(id, "conflict", "Conflict occurred");

    let queued = await getQueuedMutations();
    expect(queued[0].status).toBe("conflict");
    expect(queued[0].error).toBe("Conflict occurred");

    await dequeueMutation(id);
    queued = await getQueuedMutations();
    expect(queued.length).toBe(0);
  });

  it("apiClient response interceptor queues offline mutations automatically", async () => {
    // Intercept mock axios call rejection
    const mockOfflineError = {
      config: {
        method: "POST",
        url: "/api/meetings",
        headers: {},
        data: { title: "Offline Meeting" },
      },
    };

    // Trigger the response interceptor manually or verify error handling
    let errorCaught = null;
    try {
      // Execute response interceptor catch block
      await apiClient.interceptors.response.handlers[0].rejected(
        mockOfflineError,
      );
    } catch (err) {
      errorCaught = err;
    }

    expect(errorCaught).not.toBeNull();
    expect(errorCaught.isOfflineQueue).toBe(true);

    const { getQueuedMutations } = await import("../offlineQueue.js");
    const queued = await getQueuedMutations();
    expect(queued.length).toBe(1);
    expect(queued[0].url).toContain("/api/meetings");
    expect(queued[0].method).toBe("POST");
  });

  it("subscribes to queue changes and receives updates", async () => {
    const { queueMutation, dequeueMutation, subscribeQueue } =
      await import("../offlineQueue.js");

    const received = [];
    const unsubscribe = subscribeQueue((queue) => {
      received.push(queue.length);
    });

    const id = await queueMutation({
      url: "https://api.test/tags",
      method: "POST",
      body: { name: "urgent" },
    });

    await dequeueMutation(id);
    unsubscribe();

    expect(received).toContain(1);
    expect(received).toContain(0);
  });

  it("replays mutation successfully and removes from queue", async () => {
    const { queueMutation, replayMutation, getQueuedMutations } =
      await import("../offlineQueue.js");

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });

    const id = await queueMutation({
      url: "https://api.test/tasks/123",
      method: "PATCH",
      body: { completed: true },
    });

    const result = await replayMutation(id);
    expect(result.success).toBe(true);

    const queued = await getQueuedMutations();
    expect(queued.length).toBe(0);
  });

  it("handles failed replay and updates mutation status with error", async () => {
    const { queueMutation, replayMutation, getQueuedMutations } =
      await import("../offlineQueue.js");

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: "Internal server error" }),
    });

    const id = await queueMutation({
      url: "https://api.test/tasks/123",
      method: "PATCH",
      body: { completed: true },
    });

    const result = await replayMutation(id);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Internal server error");

    const queued = await getQueuedMutations();
    expect(queued.length).toBe(1);
    expect(queued[0].status).toBe("failed");
    expect(queued[0].error).toBe("Internal server error");
  });

  it("replays all queued mutations sequentially with progress callbacks", async () => {
    const { queueMutation, replayQueuedMutations, getQueuedMutations } =
      await import("../offlineQueue.js");

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

    await queueMutation({ url: "https://api.test/1", method: "POST" });
    await queueMutation({ url: "https://api.test/2", method: "POST" });

    const progressReports = [];
    const summary = await replayQueuedMutations({
      onProgress: (p) => progressReports.push(p.current),
    });

    expect(summary.total).toBe(2);
    expect(summary.succeeded).toBe(2);
    expect(summary.failed).toBe(0);
    expect(progressReports).toEqual([1, 2]);

    const queued = await getQueuedMutations();
    expect(queued.length).toBe(0);
  });

  it("clears all queued mutations with clearQueue", async () => {
    const { queueMutation, clearQueue, getQueuedMutations } =
      await import("../offlineQueue.js");

    await queueMutation({ url: "https://api.test/1", method: "POST" });
    await queueMutation({ url: "https://api.test/2", method: "POST" });

    let queued = await getQueuedMutations();
    expect(queued.length).toBe(2);

    await clearQueue();
    queued = await getQueuedMutations();
    expect(queued.length).toBe(0);
  });
});
