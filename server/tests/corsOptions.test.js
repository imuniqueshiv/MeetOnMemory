import { describe, it, expect } from "vitest";
import { corsOptions, allowedOrigins } from "../config/corsOptions.js";

describe("corsOptions", () => {
  it("allows approved origins", () => {
    const testOrigin = allowedOrigins[0];
    corsOptions.origin(testOrigin, (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(true);
    });
  });

  it("rejects untrusted origins", () => {
    corsOptions.origin("http://untrusted.com", (err, allow) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe("Not allowed by CORS");
    });
  });

  it("explicitly rejects null origin", () => {
    corsOptions.origin("null", (err, allow) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe("Not allowed by CORS");
    });
  });

  it("allows requests with missing origin (server-to-server / CLI)", () => {
    corsOptions.origin(undefined, (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(true);
    });
  });

  it("grants credentials only to approved origins", () => {
    const approvedOrigin = allowedOrigins[0];
    const reqApproved = { headers: { origin: approvedOrigin } };
    corsOptions.credentials(reqApproved, (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(true);
    });

    const reqNull = { headers: { origin: "null" } };
    corsOptions.credentials(reqNull, (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(false);
    });

    const reqMissing = { headers: {} };
    corsOptions.credentials(reqMissing, (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(false);
    });

    const reqUntrusted = { headers: { origin: "http://untrusted.com" } };
    corsOptions.credentials(reqUntrusted, (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(false);
    });
  });
});
