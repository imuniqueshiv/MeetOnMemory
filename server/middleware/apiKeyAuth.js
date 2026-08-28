import crypto from "crypto";
import ApiKey from "../models/apiKeyModel.js";

/**
 * Generate a cryptographically secure API key
 * Prefix: mom_live_
 */
export const generateApiKeySecret = () => {
  const randomBytes = crypto.randomBytes(24).toString("hex");
  const secretKey = `mom_live_${randomBytes}`;
  const hashedKey = hashApiKey(secretKey);
  const keyPreview = `${secretKey.slice(0, 12)}...${secretKey.slice(-4)}`;

  return {
    secretKey,
    hashedKey,
    keyPreview,
  };
};

/**
 * Hash raw API key with SHA-256
 */
export const hashApiKey = (rawKey) => {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
};

/**
 * Middleware to authenticate requests using Bearer or X-API-Key headers
 */
export const authenticateApiKey = async (req, res, next) => {
  try {
    const rawKey =
      req.headers["x-api-key"] ||
      (req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer mom_")
        ? req.headers.authorization.split(" ")[1]
        : null);

    if (!rawKey) {
      return res.status(401).json({
        success: false,
        message: "API key missing. Provide via X-API-Key or Bearer header.",
      });
    }

    const hashedKey = hashApiKey(rawKey);
    const keyDoc = await ApiKey.findOne({
      hashedKey,
      status: "active",
    }).populate("organization");

    if (!keyDoc) {
      return res.status(401).json({
        success: false,
        message: "Invalid or revoked API key.",
      });
    }

    if (keyDoc.isExpired()) {
      return res.status(401).json({
        success: false,
        message: "API key has expired.",
      });
    }

    // Update last used timestamp asynchronously
    ApiKey.findByIdAndUpdate(keyDoc._id, { lastUsedAt: new Date() }).exec();

    req.apiKey = keyDoc;
    req.organization = keyDoc.organization;
    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "API key authentication failed.",
      error: err.message,
    });
  }
};

/**
 * Scope enforcement middleware generator
 */
export const requireApiKeyScope = (requiredScope) => {
  return (req, res, next) => {
    if (!req.apiKey) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthenticated API request." });
    }

    if (!req.apiKey.scopes.includes(requiredScope)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: API key lacks the required scope '${requiredScope}'.`,
      });
    }

    next();
  };
};
