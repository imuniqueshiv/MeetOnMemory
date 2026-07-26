import { jest } from "@jest/globals";
import {
  buildCsrfInvalidResponse,
  CSRF_INVALID,
  CSRF_INVALID_MESSAGE,
  sendCsrfInvalid,
} from "../utils/csrfErrors.js";

// errorHandler statically imports csrfErrors. Importing both here as static
// deps creates a Jest/Node ESM diamond (test → csrfErrors, test → errorHandler
// → csrfErrors) that triggers "module is already linked". Load the handler
// only after csrfErrors is already linked/evaluated.
describe("CSRF error responses", () => {
  it("builds the standardized CSRF_INVALID payload", () => {
    expect(buildCsrfInvalidResponse()).toEqual({
      success: false,
      code: CSRF_INVALID,
      message: CSRF_INVALID_MESSAGE,
    });
  });

  it("sends a 403 CSRF_INVALID response", () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    sendCsrfInvalid(res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      code: "CSRF_INVALID",
      message: "CSRF token validation failed.",
    });
  });

  it("maps EBADCSRFTOKEN through the global error handler", async () => {
    const { default: errorHandler } =
      await import("../middleware/errorHandler.js");

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    errorHandler({ code: "EBADCSRFTOKEN" }, {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      code: "CSRF_INVALID",
      message: "CSRF token validation failed.",
    });
  });

  it("maps ZodError-shaped errors through the global error handler", async () => {
    const { default: errorHandler } =
      await import("../middleware/errorHandler.js");

    // Exercise the structural ZodError contract without importing `zod`
    // (zod's ESM graph still trips Jest's VM linker on this Node version).
    const zodErr = new Error("Validation failed");
    zodErr.name = "ZodError";
    zodErr.issues = [{ path: ["email"], message: "Invalid email" }];

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    errorHandler(zodErr, {}, res, () => {});

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Validation failed.",
      details: [{ field: "email", message: "Invalid email" }],
    });
  });
});
