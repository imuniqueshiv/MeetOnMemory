import mongoose from "mongoose";
import { jest } from "@jest/globals";
import AuditService from "../services/AuditService.js";
import AuditLog from "../models/auditLogModel.js";

describe("AuditService", () => {
  let consoleWarnSpy;
  let consoleErrorSpy;

  let auditLogCreateSpy;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Spy on the Mongoose model method
    auditLogCreateSpy = jest
      .spyOn(AuditLog, "create")
      .mockImplementation(() => {});

    // Spy on console.warn and console.error to keep test output clean and assert on them
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    auditLogCreateSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("should successfully create an audit log when all required fields are provided", async () => {
    // Arrange
    const actorId = new mongoose.Types.ObjectId().toString();
    const organizationId = new mongoose.Types.ObjectId().toString();
    const entityId = new mongoose.Types.ObjectId().toString();

    auditLogCreateSpy.mockResolvedValueOnce({ _id: "mock-log-id" });

    const logData = {
      actorId,
      action: "POLICY_CREATED",
      entity: "Policy",
      entityId,
      organizationId,
      details: { test: "data" },
    };

    // Act
    await AuditService.logAction(logData);

    // Assert
    expect(auditLogCreateSpy).toHaveBeenCalledTimes(1);
    expect(auditLogCreateSpy).toHaveBeenCalledWith({
      actor: actorId,
      action: "POLICY_CREATED",
      entity: "Policy",
      entityId,
      organization: organizationId,
      details: { test: "data" },
    });
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("should abort and log a warning if required fields are missing", async () => {
    // Arrange - Missing actorId
    const logData = {
      action: "POLICY_CREATED",
      entity: "Policy",
      entityId: "some-id",
      organizationId: "some-org-id",
    };

    // Act
    await AuditService.logAction(logData);

    // Assert
    expect(auditLogCreateSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Missing required fields"),
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("should safely catch and log errors without crashing if the database operation fails", async () => {
    // Arrange
    const actorId = new mongoose.Types.ObjectId().toString();

    const dbError = new Error("Database connection lost");
    auditLogCreateSpy.mockRejectedValueOnce(dbError);

    const logData = {
      actorId,
      action: "POLICY_CREATED",
      entity: "Policy",
      entityId: "some-id",
      organizationId: "some-org-id",
    };

    // Act - Should NOT throw an error because it's wrapped in a try/catch
    await AuditService.logAction(logData);

    // Assert
    expect(auditLogCreateSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("AuditService failed to write log"),
      dbError,
    );
  });
});
