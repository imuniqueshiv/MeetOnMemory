import { describe, it, expect, vi, beforeEach } from "vitest";
import { getBackendUrl, DEFAULT_BACKEND_URL } from "../backendConfig.js";

describe("backendConfig utility", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should return DEFAULT_BACKEND_URL when no env variables are set", () => {
    const url = getBackendUrl();
    expect(url).toBe(DEFAULT_BACKEND_URL);
    expect(url).toBe("http://localhost:4000");
  });

  it("should trim trailing slashes from resolved URL", () => {
    const originalViteUrl = import.meta.env.VITE_BACKEND_URL;
    import.meta.env.VITE_BACKEND_URL = "http://localhost:4000///";
    expect(getBackendUrl()).toBe("http://localhost:4000");
    import.meta.env.VITE_BACKEND_URL = originalViteUrl;
  });
});
