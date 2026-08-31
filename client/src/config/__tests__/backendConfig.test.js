import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getBackendUrl,
  DEFAULT_BACKEND_URL,
  backendConfig,
} from "../backendConfig.js";

describe("backendConfig API URL Resolution Order (#2658)", () => {
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    // Restore environment
    import.meta.env.VITE_BACKEND_URL = originalEnv.VITE_BACKEND_URL;
    import.meta.env.VITE_API_URL = originalEnv.VITE_API_URL;
  });

  it("should prioritize VITE_BACKEND_URL over VITE_API_URL", () => {
    import.meta.env.VITE_BACKEND_URL = "https://primary.meet.ai";
    import.meta.env.VITE_API_URL = "https://fallback.meet.ai";

    expect(getBackendUrl()).toBe("https://primary.meet.ai");
    expect(backendConfig.apiUrl).toBe("https://primary.meet.ai");
  });

  it("should fallback to VITE_API_URL if VITE_BACKEND_URL is absent or empty", () => {
    delete import.meta.env.VITE_BACKEND_URL;
    import.meta.env.VITE_API_URL = "https://fallback.meet.ai";

    expect(getBackendUrl()).toBe("https://fallback.meet.ai");
    expect(backendConfig.apiUrl).toBe("https://fallback.meet.ai");
  });

  it("should default to localhost:4000 when both environment variables are missing", () => {
    delete import.meta.env.VITE_BACKEND_URL;
    delete import.meta.env.VITE_API_URL;

    expect(getBackendUrl()).toBe(DEFAULT_BACKEND_URL);
    expect(backendConfig.apiUrl).toBe("http://localhost:4000");
  });

  it("should trim trailing slashes from resolved URLs", () => {
    import.meta.env.VITE_BACKEND_URL = "https://primary.meet.ai///";
    expect(getBackendUrl()).toBe("https://primary.meet.ai");

    delete import.meta.env.VITE_BACKEND_URL;
    import.meta.env.VITE_API_URL = "https://fallback.meet.ai///";
    expect(getBackendUrl()).toBe("https://fallback.meet.ai");
  });

  it("should respect custom environment overrides passed as parameters", () => {
    expect(
      getBackendUrl({
        VITE_BACKEND_URL: "https://custom-backend.ai",
        VITE_API_URL: "https://custom-fallback.ai",
      }),
    ).toBe("https://custom-backend.ai");

    expect(
      getBackendUrl({
        VITE_API_URL: "https://custom-fallback.ai",
      }),
    ).toBe("https://custom-fallback.ai");

    expect(getBackendUrl({})).toBe("http://localhost:4000");
  });
});
