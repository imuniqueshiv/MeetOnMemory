import { describe, it, expect } from "vitest";
import { getClientIp } from "../utils/ipUtils.js";

describe("Rate Limiter IP Sanitization & Spoofing Prevention", () => {
  it("uses req.ip provided by express trust proxy", () => {
    const req = {
      ip: "203.0.113.195",
      headers: {
        "x-forwarded-for": "198.51.100.1, 203.0.113.195",
      },
    };

    const clientIp = getClientIp(req);
    expect(clientIp).toBe("203.0.113.195");
  });

  it("extracts remoteAddress when req.ip is unpopulated", () => {
    const req = {
      socket: { remoteAddress: "198.51.100.5" },
      headers: {},
    };

    const clientIp = getClientIp(req);
    expect(clientIp).toBe("198.51.100.5");
  });

  it("sanitizes first IP from X-Forwarded-For if socket and req.ip are absent", () => {
    const req = {
      headers: {
        "x-forwarded-for": "203.0.113.50, 10.0.0.1",
      },
    };

    const clientIp = getClientIp(req);
    expect(clientIp).toBe("203.0.113.50");
  });

  it("returns fallback localhost IP when request object is empty", () => {
    expect(getClientIp(null)).toBe("127.0.0.1");
    expect(getClientIp({})).toBe("127.0.0.1");
  });
});
