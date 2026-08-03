import { jest } from "@jest/globals";
import mongoose from "mongoose";
import { ValidationError, ForbiddenError } from "../utils/errors.js";

jest.unstable_mockModule("../models/actionItemModel.js", () => ({
  default: {
    find: jest.fn(),
  },
}));

const { default: ActionItem } = await import("../models/actionItemModel.js");
const { resolveSourceActionItemIds } =
  await import("../utils/sourceActionItemLinks.js");

describe("resolveSourceActionItemIds (#721)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns empty array when no ids are provided", async () => {
    await expect(resolveSourceActionItemIds("org-1", [])).resolves.toEqual([]);
    await expect(resolveSourceActionItemIds("org-1")).resolves.toEqual([]);
    expect(ActionItem.find).not.toHaveBeenCalled();
  });

  it("rejects invalid ObjectIds", async () => {
    await expect(
      resolveSourceActionItemIds("org-1", ["not-an-id"]),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects when an action item is missing", async () => {
    const id = new mongoose.Types.ObjectId().toString();
    ActionItem.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue([]),
    });

    await expect(
      resolveSourceActionItemIds("org-1", [id]),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects cross-organization action items", async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const orgA = new mongoose.Types.ObjectId();
    const orgB = new mongoose.Types.ObjectId();

    ActionItem.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue([
        {
          _id: id,
          sourceMeetingId: { organization: orgB },
        },
      ]),
    });

    await expect(resolveSourceActionItemIds(orgA, [id])).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("accepts action items that belong to the organization", async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const orgId = new mongoose.Types.ObjectId();

    ActionItem.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue([
        {
          _id: id,
          sourceMeetingId: { organization: orgId },
        },
      ]),
    });

    await expect(resolveSourceActionItemIds(orgId, [id, id])).resolves.toEqual([
      id,
    ]);
  });
});
