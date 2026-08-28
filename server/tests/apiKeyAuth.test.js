import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateApiKeySecret,
  hashApiKey,
  authenticateApiKey,
  requireApiKeyScope,
} from "../middleware/apiKeyAuth.js";
import ApiKey from "../models/apiKeyModel.js";

vi.mock("../models/apiKeyModel.js", () => ({
  default: {
    findOne: vi.fn(),
    findByIdAndUpdate: vi.fn().mockReturnValue({ exec: vi.fn() }),
  },
}));

describe("API Key Authentication & Hashing (#2264)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates secret keys starting with mom_live_ and produces sha256 hashes", () => {
    const keyData = generateApiKeySecret();

    expect(keyData.secretKey.startsWith("mom_live_")).toBe(true);
    expect(keyData.hashedKey).toBe(hashApiKey(keyData.secretKey));
    expect(keyData.keyPreview.length).toBeGreaterThan(10);
  });

  it("authenticates valid API key in X-API-Key header", async () => {
    const rawKey = "mom_live_abcdef1234567890abcdef1234567890";
    const hashed = hashApiKey(rawKey);

    const mockKeyDoc = {
      _id: "key_1",
      name: "Test Key",
      status: "active",
      organization: { _id: "org_1", name: "Acme Corp" },
      scopes: ["meetings:read", "transcripts:read"],
      isExpired: () => false,
    };

    ApiKey.findOne.mockReturnValue({
      populate: vi.fn().mockResolvedValue(mockKeyDoc),
    });

    const req = {
      headers: { "x-api-key": rawKey },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    await authenticateApiKey(req, res, next);

    expect(ApiKey.findOne).toHaveBeenCalledWith({
      hashedKey: hashed,
      status: "active",
    });
    expect(req.apiKey).toEqual(mockKeyDoc);
    expect(req.organization).toEqual(mockKeyDoc.organization);
    expect(next).toHaveBeenCalled();
  });

  it("enforces required API key scopes", () => {
    const middleware = requireApiKeyScope("transcripts:read");

    const reqValid = {
      apiKey: { scopes: ["meetings:read", "transcripts:read"] },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    middleware(reqValid, res, next);
    expect(next).toHaveBeenCalled();

    const reqForbidden = {
      apiKey: { scopes: ["meetings:read"] },
    };
    const nextForbidden = vi.fn();
    middleware(reqForbidden, res, nextForbidden);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(nextForbidden).not.toHaveBeenCalled();
  });
});
