import ApiKey from "../models/apiKeyModel.js";
import { generateApiKeySecret } from "../middleware/apiKeyAuth.js";

const resolveUserOrgId = (req) => {
  return (
    req.user?.organization?._id?.toString() ||
    req.user?.organization?.toString() ||
    req.user?.organizationId?.toString() ||
    req.headers["x-organization-id"] ||
    req.query?.organizationId ||
    req.body?.organizationId
  );
};

/**
 * List API keys for the current organization
 */
export const getOrgApiKeys = async (req, res) => {
  try {
    const orgId = resolveUserOrgId(req);
    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: "Organization ID is required to list API keys.",
      });
    }

    const keys = await ApiKey.find({ organization: orgId })
      .select("-hashedKey")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      apiKeys: keys,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch organization API keys.",
      error: err.message,
    });
  }
};

/**
 * Create a new API key / Personal Access Token for organization
 */
export const createOrgApiKey = async (req, res) => {
  try {
    const { name, scopes, expiresInDays } = req.body;
    const orgId = resolveUserOrgId(req);

    if (!name || !orgId) {
      return res.status(400).json({
        success: false,
        message: "Key name and organization ID are required.",
      });
    }

    const { secretKey, hashedKey, keyPreview } = generateApiKeySecret();

    let expiresAt = null;
    if (expiresInDays && Number(expiresInDays) > 0) {
      expiresAt = new Date(
        Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000,
      );
    }

    const newKey = await ApiKey.create({
      name,
      keyPreview,
      hashedKey,
      organization: orgId,
      createdBy: req.user?._id || req.user?.id,
      scopes: Array.isArray(scopes) && scopes.length > 0 ? scopes : undefined,
      expiresAt,
    });

    res.status(201).json({
      success: true,
      message:
        "API key generated successfully. Copy the secret key now; it will not be shown again.",
      apiKey: {
        _id: newKey._id,
        name: newKey.name,
        keyPreview: newKey.keyPreview,
        scopes: newKey.scopes,
        expiresAt: newKey.expiresAt,
        createdAt: newKey.createdAt,
      },
      secretKey, // Returned ONLY on initial creation
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to create API key.",
      error: err.message,
    });
  }
};

/**
 * Revoke an API key
 */
export const revokeOrgApiKey = async (req, res) => {
  try {
    const { keyId } = req.params;
    const orgId = resolveUserOrgId(req);
    const query = { _id: keyId };
    if (orgId) {
      query.organization = orgId;
    }

    const key = await ApiKey.findOne(query);

    if (!key) {
      return res
        .status(404)
        .json({ success: false, message: "API key not found." });
    }

    key.status = "revoked";
    await key.save();

    res.json({
      success: true,
      message: "API key revoked successfully.",
      apiKey: {
        _id: key._id,
        status: key.status,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to revoke API key.",
      error: err.message,
    });
  }
};

/**
 * Regenerate an API key (rotates secret and re-enables active state)
 */
export const rotateOrgApiKey = async (req, res) => {
  try {
    const { keyId } = req.params;
    const orgId = resolveUserOrgId(req);
    const query = { _id: keyId };
    if (orgId) {
      query.organization = orgId;
    }

    const key = await ApiKey.findOne(query);

    if (!key) {
      return res
        .status(404)
        .json({ success: false, message: "API key not found." });
    }

    const { secretKey, hashedKey, keyPreview } = generateApiKeySecret();

    key.hashedKey = hashedKey;
    key.keyPreview = keyPreview;
    key.status = "active";
    key.lastUsedAt = null;
    await key.save();

    res.json({
      success: true,
      message:
        "API key rotated successfully. Store your new secret key securely.",
      apiKey: {
        _id: key._id,
        name: key.name,
        keyPreview: key.keyPreview,
        status: key.status,
      },
      secretKey,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to rotate API key.",
      error: err.message,
    });
  }
};
