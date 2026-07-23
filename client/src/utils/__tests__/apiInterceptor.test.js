import { describe, it, expect, beforeEach, afterEach } from "vitest";
import axios from "axios";
import "../apiInterceptor"; // This attaches the interceptor

// Helper to mock HTTP errors
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

// Helper to mock network errors
function mockNetworkError() {
  axios.defaults.adapter = async () => {
    return Promise.reject(new Error("Network Error"));
  };
}

describe("apiInterceptor", () => {
  let originalAdapter;

  beforeEach(() => {
    originalAdapter = axios.defaults.adapter;
  });

  afterEach(() => {
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

  it("handles missing response.data", async () => {
    axios.defaults.adapter = async () => {
      return Promise.reject({
        response: {
          status: 500,
        },
      });
    };

    try {
      await axios.get("/test");
    } catch (error) {
      expect(error.message).toBe("Server unavailable. Please try again later.");
      expect(error.response.data.message).toBe(
        "Server unavailable. Please try again later.",
      );
    }
  });

  it("uses backend message for unknown status codes", async () => {
    mockHttpError(418, {
      message: "Custom backend error",
    });

    try {
      await axios.get("/test");
    } catch (error) {
      expect(error.message).toBe("Custom backend error");
      expect(error.response.data.message).toBe("Custom backend error");
    }
  });

  it("uses default message for unknown status without backend message", async () => {
    mockHttpError(499, {});

    try {
      await axios.get("/test");
    } catch (error) {
      expect(error.message).toBe(
        "An unexpected error occurred. Please try again.",
      );
    }
  });

  it("handles empty response object", async () => {
    axios.defaults.adapter = async () => {
      return Promise.reject({
        response: {},
      });
    };

    try {
      await axios.get("/test");
    } catch (error) {
      expect(error.message).toBe(
        "An unexpected error occurred. Please try again.",
      );
    }
  });

  it("handles missing response object", async () => {
    axios.defaults.adapter = async () => {
      return Promise.reject({});
    };

    try {
      await axios.get("/test");
    } catch (error) {
      expect(error.message).toBe(
        "Network offline. Please check your internet connection.",
      );
    }
  });
});