/**
 * Policy Controller — HTTP layer only.
 *
 * Responsibilities:
 *  1. Parse and validate the incoming HTTP request (using Zod schemas).
 *  2. Delegate all business logic to PolicyService.
 *  3. Shape and send the HTTP response.
 *  4. Forward any error to the global error handler via next(err).
 *
 * This file intentionally contains NO database queries, NO AI calls, and
 * NO file-system operations beyond what Multer provides.  All of that lives
 * in server/services/PolicyService.js.
 */

import fs from "fs";
import path from "path";
import { z } from "zod";
import * as PolicyService from "../services/PolicyService.js";
import { ValidationError, UnauthorizedError } from "../utils/errors.js";
import AuditService from "../services/AuditService.js";
import { sendSuccess } from "../utils/responseHandler.js";
import * as activityService from "../services/activityService.js";
import { getContentDispositionHeader } from "../utils/fileUtils.js";
// ═══════════════════════════════════════════════════════════════
// Zod validation schemas
// ═══════════════════════════════════════════════════════════════

const uploadPolicySchema = z.object({
  commitMsg: z.string().optional().default(""),
});

// ── Helper: extract userId from the request ───────────────────
const getUserId = (req) => {
  const id = req.user?.id || req.user?._id;
  if (!id) throw new UnauthorizedError();
  return id.toString();
};

// ═══════════════════════════════════════════════════════════════
// Controller handlers
// ═══════════════════════════════════════════════════════════════

/* ─────────────────────────────────────────────────────────────
   1. UPLOAD & PROCESS POLICY
   ───────────────────────────────────────────────────────────── */
export const uploadPolicy = async (req, res, next) => {
  // Track file path so we can clean up on failure
  const uploadedFilePath = req.file?.path || null;
  let isPersisted = false;

  try {
    if (!req.file) {
      throw new ValidationError("No file uploaded.");
    }

    const uploaderId = getUserId(req);

    let validated;
    try {
      validated = uploadPolicySchema.parse(req.body);
    } catch (zodErr) {
      throw zodErr; // Propagation to catch block unlinks the uploaded file
    }

    const { policy, isUpdate } = await PolicyService.uploadAndProcessPolicy(
      uploaderId,
      req.user?.organization || null,
      req.file,
      validated.commitMsg,
    );

    isPersisted = true; // DB persistence succeeded; do not delete file on subsequent failures

    const orgId = req.user?.organization || policy.organization;
    if (orgId) {
      AuditService.logAction({
        actorId: uploaderId,
        action: isUpdate ? "POLICY_UPDATED" : "POLICY_CREATED",
        entity: "Policy",
        entityId: policy._id,
        organizationId: orgId,
        details: { title: policy.title, commitMsg: validated.commitMsg },
      });

      const io = req.app.get("io");
      activityService.logActivity(
        io,
        orgId,
        uploaderId,
        isUpdate ? "policy.updated" : "policy.created",
        "Policy",
        policy._id,
        policy.title,
      );
    }

    return sendSuccess(
      res,
      { policyId: policy._id, policy },
      isUpdate
        ? "Policy updated and analyzed by AI."
        : "Policy uploaded and analyzed successfully.",
      isUpdate ? 200 : 201,
    );
  } catch (err) {
    // Only clean up if the file was not successfully saved in DB
    if (uploadedFilePath && !isPersisted) {
      try {
        const resolvedPath = path.resolve(uploadedFilePath);
        const uploadsDir = path.resolve("uploads");
        if (
          resolvedPath.startsWith(uploadsDir) &&
          fs.existsSync(resolvedPath)
        ) {
          fs.unlinkSync(resolvedPath);
        }
      } catch {
        // ignore cleanup errors
      }
    }
    next(err);
  }
};

/* ─────────────────────────────────────────────────────────────
   2. RE-ANALYZE POLICY (on-demand AI retry)
   ───────────────────────────────────────────────────────────── */
export const analyzePolicy = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const orgId = req.user?.organization || null;
    const policy = await PolicyService.reanalyzePolicy(
      req.params.id,
      userId,
      orgId,
    );

    return sendSuccess(
      res,
      { summary: policy.summary, keywords: policy.keywords },
      "Policy re-analyzed successfully.",
    );
  } catch (err) {
    next(err);
  }
};

/* ─────────────────────────────────────────────────────────────
   3. GET ALL POLICIES
   ───────────────────────────────────────────────────────────── */
export const getPolicies = async (req, res, next) => {
  try {
    const userId = getUserId(req);

    const policies = await PolicyService.getAllPolicies(
      userId,
      req.user?.organization || null,
    );

    res.setHeader(
      "Cache-Control",
      "public, max-age=3600, stale-while-revalidate=86400",
    );

    return sendSuccess(res, { policies });
  } catch (err) {
    next(err);
  }
};

/* ─────────────────────────────────────────────────────────────
   4. DOWNLOAD POLICY FILE
   ───────────────────────────────────────────────────────────── */
export const downloadPolicy = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const orgId = req.user?.organization || null;
    const { safeFilePath, fileName } =
      await PolicyService.getPolicyDownloadPath(req.params.id, userId, orgId);

    res.setHeader(
      "Cache-Control",
      "public, max-age=3600, stale-while-revalidate=86400",
    );

    res.setHeader("Content-Disposition", getContentDispositionHeader(fileName));

    return res.sendFile(safeFilePath);
  } catch (err) {
    next(err);
  }
};

/* ─────────────────────────────────────────────────────────────
   4b. COMPARE TWO VERSIONS OF THE SAME POLICY
   ───────────────────────────────────────────────────────────── */
export const comparePolicyVersions = async (req, res, next) => {
  try {
    const from = typeof req.query.from === "string" ? req.query.from : "";
    const to = typeof req.query.to === "string" ? req.query.to : "";

    const comparison = await PolicyService.comparePolicyVersions(
      req.params.id,
      from,
      to,
    );

    return sendSuccess(res, comparison, "Policy version diff generated.");
  } catch (err) {
    next(err);
  }
};

/* ─────────────────────────────────────────────────────────────
   5. DELETE POLICY
   ───────────────────────────────────────────────────────────── */
export const deletePolicy = async (req, res, next) => {
  try {
    // req.doc is injected by requireOwnerOrAdmin middleware if configured
    let policy = req.doc;

    if (!policy) {
      // Fallback: fetch the policy here if middleware didn't pre-load it
      const { default: Policy } = await import("../models/policyModel.js");
      policy = await Policy.findById(req.params.id);
    }

    if (!policy) {
      const { NotFoundError } = await import("../utils/errors.js");
      throw new NotFoundError("Policy not found.");
    }

    await PolicyService.deletePolicy(policy);

    if (policy.organization) {
      AuditService.logAction({
        actorId: getUserId(req),
        action: "POLICY_DELETED",
        entity: "Policy",
        entityId: policy._id,
        organizationId: policy.organization,
        details: { title: policy.title },
      });

      const io = req.app.get("io");
      activityService.logActivity(
        io,
        policy.organization,
        getUserId(req),
        "policy.deleted",
        "Policy",
        policy._id,
        policy.title,
      );
    }

    return sendSuccess(res, null, "Policy deleted successfully.");
  } catch (err) {
    next(err);
  }
};
