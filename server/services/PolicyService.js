/**
 * PolicyService.js
 *
 * Contains ALL business logic for policy operations that was previously
 * mixed into policyController.js. Controllers delegate every data-access
 * or complex operation to this service and only handle HTTP concerns.
 *
 * Error signalling: services throw custom AppError subclasses (see
 * utils/errors.js); controllers pass these to next(err) so the global
 * error handler converts them to the right HTTP response.
 */

import fs from "fs";
import path from "path";
import axios from "axios";
import { createRequire } from "module";

import Policy from "../models/policyModel.js";
import PolicyCompliance from "../models/policyComplianceModel.js";
import eventBus from "./eventBus.js";
import {
  indexPolicy,
  removePolicyFromIndex,
  reevaluatePolicyDecisions,
} from "./policyComplianceService.js";
import { NotFoundError } from "../utils/errors.js";

// ── pdf-parse (CJS module — requires dynamic require) ──────────
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

// ── Config ─────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// ── Upload directory setup ─────────────────────────────────────
const UPLOAD_DIR = path.resolve("uploads/policies");
const UPLOAD_ROOT = UPLOAD_DIR;

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ═══════════════════════════════════════════════════════════════
// Private helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Validates a file path to prevent directory traversal attacks (CWE-22).
 * Ensures that the resolved path stays strictly within UPLOAD_ROOT.
 *
 * @param {string} filePath - Path to validate
 * @returns {string} Fully resolved, safe absolute path
 * @throws {Error} If path traversal is detected
 */
const _validateUploadPath = (filePath) => {
  if (!filePath) throw new Error("Path is empty or undefined");
  const resolvedPath = path.resolve(filePath);
  const relative = path.relative(UPLOAD_ROOT, resolvedPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path traversal detected: Access denied");
  }
  return resolvedPath;
};

/**
 * Strip markdown code fences that Gemini sometimes wraps around JSON output.
 */
const _extractJson = (raw) => {
  if (!raw) return "{}";
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
};

/**
 * Call Gemini to summarize a policy document and extract keywords.
 *
 * @param {string} fileName    - Original filename (used in the prompt)
 * @param {string} textContent - Extracted plain text of the document
 * @returns {Promise<{summary: string, key_changes: string[], keywords: string[]}>}
 */
const _generatePolicySummary = async (fileName, textContent) => {
  try {
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const prompt = `
You are an AI compliance analyst. Analyze the policy document content below and return a structured JSON like this:
{
  "summary": "2–3 paragraph concise summary describing the document's purpose, scope, and main clauses.",
  "key_changes": ["List of main changes or revisions if applicable, otherwise leave as empty array."],
  "keywords": ["Short tags describing policy topics (5–10 tags)"]
}

Policy File Name: ${fileName}

Policy Text Content:
${textContent?.slice(0, 6000)}

Return ONLY valid JSON (no commentary, no markdown fences). Use a professional, compliance-focused tone.
`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      { contents: [{ parts: [{ text: prompt }] }] },
      { timeout: 30000 },
    );

    const rawText =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const cleanedText = _extractJson(rawText);
    const parsed = JSON.parse(cleanedText);

    return {
      summary:
        typeof parsed.summary === "string" && parsed.summary.trim()
          ? parsed.summary.trim()
          : "AI summary could not be generated for this document.",
      key_changes: Array.isArray(parsed.key_changes) ? parsed.key_changes : [],
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    };
  } catch (error) {
    console.error("❌ Gemini summarization failed:", error.message);

    if (error.response?.status === 429)
      console.warn("⚠️ Gemini rate limit exceeded.");
    else if (error.response?.status === 400)
      console.warn("⚠️ Gemini bad request — likely invalid prompt content.");
    else if (error.code === "ECONNABORTED")
      console.warn("⚠️ Gemini request timed out.");

    return {
      summary:
        "AI summary generation failed. You can retry analysis from the policy detail view.",
      key_changes: [],
      keywords: [],
    };
  }
};

/**
 * Extract plain text from a PDF, DOCX, or TXT file.
 *
 * @param {string} filePath  - Absolute (validated) path to the file
 * @param {string} mimetype  - MIME type to detect PDF vs. text files
 * @returns {Promise<string>}
 */
const _extractTextFromFile = async (filePath, mimetype) => {
  try {
    const safePath = _validateUploadPath(filePath);
    if (
      mimetype === "application/pdf" ||
      safePath.toLowerCase().endsWith(".pdf")
    ) {
      const pdfBuffer = fs.readFileSync(safePath);
      const data = await pdf(pdfBuffer);
      return data.text || "";
    }
    return fs.readFileSync(safePath, "utf8").toString();
  } catch (err) {
    console.warn("⚠️ Text extraction failed:", err.message);
    return "";
  }
};

// ═══════════════════════════════════════════════════════════════
// Public service methods
// ═══════════════════════════════════════════════════════════════

/**
 * 1. Upload a policy file, extract its text, generate an AI summary,
 *    handle versioning, and index into Pinecone.
 *
 * @param {string}      uploaderId - ObjectId of the authenticated user
 * @param {string|null} orgId      - Organization ObjectId (may be null)
 * @param {object}      file       - Multer file object
 * @param {string}      commitMsg  - Optional human-readable commit message
 * @returns {Promise<{policy: Policy, isUpdate: boolean}>}
 */
export const uploadAndProcessPolicy = async (
  uploaderId,
  orgId,
  file,
  commitMsg,
) => {
  const fileName = String(file.originalname);
  const fileUrl = path.join(UPLOAD_DIR, file.filename);
  const safeFileUrl = _validateUploadPath(fileUrl);

  // 1. Extract text
  const textContent = await _extractTextFromFile(safeFileUrl, file.mimetype);

  // 2. AI summary
  console.log(`📡 Calling Gemini for AI summary — "${fileName}"...`);
  const aiData = await _generatePolicySummary(fileName, textContent);
  console.log("✅ Gemini summary complete.");

  // 3. Version check
  const existing = await Policy.findOne({ name: fileName });

  if (existing) {
    // Snapshot the current version before overwriting
    existing.previousVersions.push({
      name: existing.name,
      version: existing.version,
      fileUrl: existing.fileUrl,
      commitMsg: existing.commitMsg,
      summary: existing.summary,
      key_changes: existing.key_changes,
      keywords: existing.keywords,
      uploadedBy: existing.uploadedBy,
      organization: existing.organization,
      createdAt: existing.createdAt,
    });

    existing.version = (parseFloat(existing.version) + 0.1).toFixed(1);
    existing.fileUrl = safeFileUrl;
    existing.summary = aiData.summary;
    existing.key_changes = aiData.key_changes;
    existing.keywords = aiData.keywords;
    existing.commitMsg = commitMsg || "";
    existing.lastEditedBy = uploaderId;
    existing.status = "ready";
    await existing.save();

    // Webhook event
    try {
      eventBus.emit("policy.updated", existing);
    } catch (evtErr) {
      console.error("⚠️ Failed to emit policy.updated event:", evtErr.message);
    }

    await existing.populate("uploadedBy", "name email");
    await existing.populate("lastEditedBy", "name email");

    // Re-index + re-evaluate compliance (fire-and-forget)
    indexPolicy(existing)
      .then(() => reevaluatePolicyDecisions(existing))
      .catch((err) =>
        console.error("⚠️ Policy compliance re-index failed:", err.message),
      );

    return { policy: existing, isUpdate: true };
  }

  // 4. Create new policy
  const policy = await Policy.create({
    name: fileName,
    version: "1.0",
    fileUrl: safeFileUrl,
    summary: aiData.summary,
    key_changes: aiData.key_changes,
    keywords: aiData.keywords,
    commitMsg: commitMsg || "",
    uploadedBy: uploaderId,
    lastEditedBy: uploaderId,
    organization: orgId || null,
    status: "ready",
  });

  // Webhook event
  try {
    eventBus.emit("policy.updated", policy);
  } catch (evtErr) {
    console.error("⚠️ Failed to emit policy.updated event:", evtErr.message);
  }

  await policy.populate("uploadedBy", "name email");
  await policy.populate("lastEditedBy", "name email");

  // Index (fire-and-forget)
  indexPolicy(policy).catch((err) =>
    console.error("⚠️ Policy indexing failed:", err.message),
  );

  return { policy, isUpdate: false };
};

/**
 * 2. Re-run AI analysis on an existing policy.
 *    Called when the initial Gemini pass failed or the user explicitly
 *    triggers a retry from the policy detail view.
 *
 * @param {string} policyId - ObjectId of the policy to re-analyze
 * @returns {Promise<Policy>}
 */
export const reanalyzePolicy = async (policyId) => {
  const policy = await Policy.findById(policyId);
  if (!policy) throw new NotFoundError("Policy not found.");

  const safeFileUrl = _validateUploadPath(policy.fileUrl);

  if (!fs.existsSync(safeFileUrl)) {
    throw new NotFoundError(
      "Policy file not found on disk. Cannot re-analyze.",
    );
  }

  // Mark as processing so the UI can show a spinner
  policy.status = "processing";
  await policy.save();

  try {
    const textContent = await _extractTextFromFile(safeFileUrl, null);
    const aiData = await _generatePolicySummary(policy.name, textContent);

    policy.summary = aiData.summary;
    policy.key_changes = aiData.key_changes;
    policy.keywords = aiData.keywords;
    policy.status = "ready";
    await policy.save();

    // Webhook event
    try {
      eventBus.emit("policy.updated", policy);
    } catch (evtErr) {
      console.error("⚠️ Failed to emit policy.updated event:", evtErr.message);
    }

    // Re-index + re-evaluate (fire-and-forget)
    indexPolicy(policy)
      .then(() => reevaluatePolicyDecisions(policy))
      .catch((err) =>
        console.error("⚠️ Policy compliance re-index failed:", err.message),
      );

    return policy;
  } catch (err) {
    // Reset status to failed so the user can retry again
    await Policy.findByIdAndUpdate(policyId, { status: "failed" }).catch(
      () => {},
    );
    throw err;
  }
};

/**
 * 3. Fetch all policies visible to a user (own + organization-wide).
 *
 * @param {string}      userId
 * @param {string|null} orgId
 * @returns {Promise<Policy[]>}
 */
export const getAllPolicies = async (userId, orgId) => {
  const queryOptions = [{ uploadedBy: userId }];
  if (orgId) {
    queryOptions.push({ organization: orgId });
  }

  return Policy.find({ $or: queryOptions })
    .populate("uploadedBy", "name email")
    .populate("lastEditedBy", "name email")
    .sort({ updatedAt: -1 });
};

/**
 * 4. Resolve and validate the download path for a policy file.
 *
 * @param {string} policyId
 * @returns {Promise<{safeFilePath: string, fileName: string}>}
 */
export const getPolicyDownloadPath = async (policyId) => {
  const policy = await Policy.findById(policyId);
  if (!policy) throw new NotFoundError("Policy not found.");

  const safeFilePath = _validateUploadPath(policy.fileUrl);

  if (!fs.existsSync(safeFilePath)) {
    throw new NotFoundError(
      "Policy file is no longer available on the server.",
    );
  }

  return { safeFilePath, fileName: policy.name };
};

/**
 * 5. Delete a policy, its files (current + all previous versions),
 *    its Pinecone vectors, and all related compliance records.
 *
 * @param {object} policy - Mongoose Policy document (pre-fetched by middleware or service)
 * @returns {Promise<void>}
 */
export const deletePolicy = async (policy) => {
  // Delete current file from disk
  try {
    const safeFileUrl = _validateUploadPath(policy.fileUrl);
    if (fs.existsSync(safeFileUrl)) {
      fs.unlinkSync(safeFileUrl);
    }
  } catch (fsErr) {
    console.warn("⚠️ Could not delete policy file:", fsErr.message);
  }

  // Also remove previous version files
  for (const v of policy.previousVersions || []) {
    if (v.fileUrl) {
      try {
        const safeVersionUrl = _validateUploadPath(v.fileUrl);
        if (fs.existsSync(safeVersionUrl)) {
          fs.unlinkSync(safeVersionUrl);
        }
      } catch {
        // non-fatal
      }
    }
  }

  await policy.deleteOne();

  // Cleanup Pinecone vectors and compliance records (fire-and-forget)
  removePolicyFromIndex(policy._id).catch((err) =>
    console.error("⚠️ Failed to remove policy vector:", err.message),
  );
  PolicyCompliance.deleteMany({ policyId: policy._id }).catch((err) =>
    console.error("⚠️ Failed to clean up compliance records:", err.message),
  );
};
