import { describe, expect, it, vi } from "vitest";
import { originValidationMiddleware } from "../middleware/originValidation.js";
import { allowedOrigins } from "../config/corsOptions.js";

const buildReq = ({ origin } = {}) => ({
  headers: origin === undefined ? {} : { origin },
  method: "POST",
  originalUrl: "/api/user/data",
  requestId: "req-id",
});

const buildRes = () => {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
};

describe("originValidationMiddleware", () => {
  it("allows requests without an Origin header", () => {
    const req = buildReq({ origin: undefined });
    const res = buildRes();
    const next = vi.fn();

    originValidationMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("allows a trusted origin", () => {
    const req = buildReq({ origin: allowedOrigins[0] });
    const res = buildRes();
    const next = vi.fn();

    originValidationMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects a null origin", () => {
    const req = buildReq({ origin: "null" });
    const res = buildRes();
    const next = vi.fn();

    originValidationMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Untrusted request origin.",
      requestId: "req-id",
    });
  });

  it("rejects an untrusted origin", () => {
    const req = buildReq({ origin: "http://example.com" });
    const res = buildRes();
    const next = vi.fn();

    originValidationMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Untrusted request origin.",
      requestId: "req-id",
    });
  });
});
