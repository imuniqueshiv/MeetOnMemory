import { jest } from "@jest/globals";
import mongoose from "mongoose";
import { requireOrgAccess } from "../middleware/rbac.js";

/**
 * Regression for Issue #606:
 * Transcript routes declare :meetingId while requireOrgAccess historically
 * only read req.params.id, causing "Document ID required" authorization failures.
 */
describe("requireOrgAccess meetingId param (#606)", () => {
  const meetingId = new mongoose.Types.ObjectId().toString();
  const orgId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();
  const otherOrgId = new mongoose.Types.ObjectId().toString();

  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  const createModel = (doc) => ({
    findById: jest.fn().mockResolvedValue(doc),
  });

  it("resolves the resource from req.params.meetingId (transcript routes)", async () => {
    const doc = {
      _id: meetingId,
      organization: orgId,
      uploadedBy: new mongoose.Types.ObjectId().toString(),
    };
    const Model = createModel(doc);
    const middleware = requireOrgAccess(Model);
    const req = {
      user: { _id: userId, organization: orgId, role: "member" },
      params: { meetingId },
    };
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(Model.findById).toHaveBeenCalledWith(meetingId);
    expect(req.doc).toBe(doc);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("still resolves the resource from req.params.id (meeting/policy routes)", async () => {
    const doc = {
      _id: meetingId,
      organization: orgId,
      uploadedBy: userId,
    };
    const Model = createModel(doc);
    const middleware = requireOrgAccess(Model);
    const req = {
      user: { _id: userId, organization: orgId, role: "member" },
      params: { id: meetingId },
    };
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(Model.findById).toHaveBeenCalledWith(meetingId);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("blocks users outside the organization", async () => {
    const doc = {
      _id: meetingId,
      organization: orgId,
      uploadedBy: new mongoose.Types.ObjectId().toString(),
    };
    const Model = createModel(doc);
    const middleware = requireOrgAccess(Model);
    const req = {
      user: { _id: userId, organization: otherOrgId, role: "member" },
      params: { meetingId },
    };
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Forbidden: You don't have access to this resource",
      }),
    );
  });

  it("returns 400 when neither id nor meetingId is present", async () => {
    const Model = createModel(null);
    const middleware = requireOrgAccess(Model);
    const req = {
      user: { _id: userId, organization: orgId, role: "member" },
      params: {},
    };
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(Model.findById).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Document ID required",
      }),
    );
  });
});
