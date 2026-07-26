import mongoose from "mongoose";
import MembershipRequestService from "../services/MembershipRequestService.js";
import MembershipRequest from "../models/membershipRequestModel.js";
import Membership from "../models/membershipModel.js";
import Organization from "../models/organizationModel.js";
import AuditService from "../services/AuditService.js"; // eslint-disable-line no-unused-vars
import {
  AppError,
  NotFoundError,
  ForbiddenError, // eslint-disable-line no-unused-vars
  ValidationError,
} from "../utils/errors.js";
import { jest } from "@jest/globals";

describe("MembershipRequestService", () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const organizationId = new mongoose.Types.ObjectId().toString();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("createRequest", () => {
    it("should throw ValidationError if organization ID is missing", async () => {
      await expect(
        MembershipRequestService.createRequest(userId, null, "Hello"),
      ).rejects.toThrow(ValidationError);
    });

    it("should throw ValidationError if organization ID is invalid", async () => {
      await expect(
        MembershipRequestService.createRequest(userId, "invalid-id", "Hello"),
      ).rejects.toThrow(ValidationError);
    });

    it("should throw NotFoundError if organization does not exist", async () => {
      jest.spyOn(Organization, "findById").mockResolvedValue(null);

      await expect(
        MembershipRequestService.createRequest(userId, organizationId, "Hello"),
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw ValidationError if user is already a member", async () => {
      jest
        .spyOn(Organization, "findById")
        .mockResolvedValue({ _id: organizationId });
      jest.spyOn(Membership, "findOne").mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: "membership-id" }),
      });

      await expect(
        MembershipRequestService.createRequest(userId, organizationId, "Hello"),
      ).rejects.toThrow(ValidationError);
    });

    it("should throw AppError if a pending request already exists", async () => {
      jest
        .spyOn(Organization, "findById")
        .mockResolvedValue({ _id: organizationId });
      jest.spyOn(Membership, "findOne").mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });
      jest.spyOn(MembershipRequest, "findOne").mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValue({ _id: "request-id", status: "pending" }),
      });

      await expect(
        MembershipRequestService.createRequest(userId, organizationId, "Hello"),
      ).rejects.toThrow(AppError);
    });

    it("should successfully create a membership request", async () => {
      jest
        .spyOn(Organization, "findById")
        .mockResolvedValue({ _id: organizationId });
      jest.spyOn(Membership, "findOne").mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });
      jest.spyOn(MembershipRequest, "findOne").mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const mockRequest = {
        _id: "new-request-id",
        user: userId,
        organization: organizationId,
        status: "pending",
      };
      jest.spyOn(MembershipRequest, "create").mockResolvedValue(mockRequest);

      const result = await MembershipRequestService.createRequest(
        userId,
        organizationId,
        "Hello",
      );

      expect(result).toEqual(mockRequest);
      expect(MembershipRequest.create).toHaveBeenCalledWith({
        user: userId,
        organization: expect.any(mongoose.Types.ObjectId),
        message: "Hello",
        status: "pending",
      });
    });
  });

  describe("approveRequest", () => {
    const requestId = new mongoose.Types.ObjectId().toString();

    it("should throw ValidationError if request ID is invalid", async () => {
      await expect(
        MembershipRequestService.approveRequest(userId, "invalid-id", "Ok"),
      ).rejects.toThrow(ValidationError);
    });

    it("should throw NotFoundError if request does not exist", async () => {
      jest.spyOn(MembershipRequest, "findById").mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      await expect(
        MembershipRequestService.approveRequest(userId, requestId, "Ok"),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
