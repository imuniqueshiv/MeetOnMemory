import { describe, it, expect, beforeEach, afterEach } from "vitest";
import axios from "axios";
import "../apiInterceptor"; // This attaches the interceptor

// Reusable helper for mocking HTTP error responses
function mockHttpError(status, data = {}) {
  axios.defaults.adapter = async () => {
    return Promise.reject({
      response: {
        status,
        data,
      },
    });
  };
}

// Reusable helper for mocking network failures
function mockNetworkError() {
  axios.defaults.adapter = async () => {
    return Promise.reject(new Error("Network Error"));
  };
}

describe("apiInterceptor", () => {
  let originalAdapter;

  beforeEach(() => {
    // Save original adapter
    originalAdapter = axios.defaults.adapter;
  });

  afterEach(() => {
    // Restore original adapter
    axios.defaults.adapter = originalAdapter;
  });

  it("handles 401 Unauthorized", async () => {
    mockHttpError(401);

    try {
      await axios.get("/test");
    } catch (error) {
      expect(error.message).toBe("Session expired. Please log in again.");
      expect(error.response.data.message).toBe(
        "Session expired. Please log in again.",
      );
    }
  });

  it("handles 403 Forbidden", async () => {
    mockHttpError(403);

    try {
      await axios.get("/test");
    } catch (error) {
      expect(error.message).toBe(
        "You do not have permission to perform this action.",
      );
    }
  });

  it("handles 404 Not Found", async () => {
    mockHttpError(404);

    try {
      await axios.get("/test");
    } catch (error) {
      expect(error.message).toBe("The requested resource was not found.");
    }
  });

  it("handles Server Errors (500)", async () => {
    mockHttpError(500);

    try {
      await axios.get("/test");
    } catch (error) {
      expect(error.message).toBe("Server unavailable. Please try again later.");
    }
  });

  it("handles Network Errors (no response)", async () => {
    mockNetworkError();

    try {
      await axios.get("/test");
    } catch (error) {
      expect(error.message).toBe(
        "Network offline. Please check your internet connection.",
      );
      expect(error.response.status).toBe(0);
    }
  });
});