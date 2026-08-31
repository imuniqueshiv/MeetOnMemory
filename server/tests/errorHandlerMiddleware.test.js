import { describe, it, expect, vi, beforeEach } from "vitest";
import errorHandler from "../middleware/errorHandler.js";
import {
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "../utils/errors.js";

describe("errorHandler middleware (#2663)", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      requestId: "req-test-123",
      header: vi.fn(),
      get: vi.fn(),
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it("handles ValidationError with HTTP 400 and normalized { error, message, code } shape", () => {
    const err = new ValidationError("Invalid email address");
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: "ValidationError",
        message: "Invalid email address",
        code: "VALIDATION_ERROR",
        requestId: "req-test-123",
      }),
    );
  });

  it("handles UnauthorizedError with HTTP 401 and normalized shape", () => {
    const err = new UnauthorizedError("Authentication token expired");
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: "UnauthorizedError",
        message: "Authentication token expired",
        code: "UNAUTHORIZED",
        requestId: "req-test-123",
      }),
    );
  });

  it("handles ForbiddenError with HTTP 403 and normalized shape", () => {
    const err = new ForbiddenError("Not allowed to access resource");
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: "ForbiddenError",
        message: "Not allowed to access resource",
        code: "FORBIDDEN",
        requestId: "req-test-123",
      }),
    );
  });

  it("handles NotFoundError with HTTP 404 and normalized shape", () => {
    const err = new NotFoundError("Meeting not found");
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: "NotFoundError",
        message: "Meeting not found",
        code: "NOT_FOUND",
        requestId: "req-test-123",
      }),
    );
  });

  it("handles ConflictError with HTTP 409 and normalized shape", () => {
    const err = new ConflictError("Organization slug already exists");
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: "ConflictError",
        message: "Organization slug already exists",
        code: "CONFLICT",
        requestId: "req-test-123",
      }),
    );
  });

  it("handles unhandled 500 errors gracefully with internal server error code", () => {
    const err = new Error("Unexpected database explosion");
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "Error",
          message: "Internal Server Error",
          code: "INTERNAL_SERVER_ERROR",
          requestId: "req-test-123",
        }),
      );
      expect(res.json.mock.calls[0][0].stack).toBeUndefined();
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  it("handles Mongoose CastError with HTTP 400 and INVALID_ID code", () => {
    const err = { name: "CastError", path: "_id", value: "invalid-id" };
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: "CastError",
        message: "Invalid value for field '_id'.",
        code: "INVALID_ID",
      }),
    );
  });
});
