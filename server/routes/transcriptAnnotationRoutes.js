import express from "express";
import {
  createAnnotation,
  listAnnotations,
  updateAnnotation,
  deleteAnnotation,
  resolveAnnotation,
} from "../controllers/transcriptAnnotationController.js";
import userAuth from "../middleware/userAuth.js";
import { requireOrgAccess, requireOrgMembership } from "../middleware/rbac.js";
import Meeting from "../models/meetingModel.js";

const router = express.Router({ mergeParams: true });

/**
 * Transcript annotation routes, mounted at `/api/transcript-annotations`
 * (Issue #1274).
 *
 * Only the list route carried an authorization check; the four write routes
 * had none, and the file's own comments recorded the gap as an open question
 * ("We should perhaps validate access inside createAnnotation…"). It was never
 * answered, so any authenticated user could create, edit, delete and resolve
 * annotations on any organization's transcript given only an id.
 *
 * The checks land in two different places because the routes carry two
 * different identifiers:
 *
 *   - `/meeting/:meetingId` names the meeting, so `requireOrgAccess(Meeting)`
 *     can resolve and authorize it as middleware.
 *   - `POST /` names the meeting in the *body*, and `/:id` names an annotation
 *     whose meeting has to be looked up first. Neither shape fits a middleware
 *     that reads a meeting id from the path, so those authorize inside the
 *     controller, via the same `canAccessMeetingDoc` predicate the middleware
 *     uses.
 *
 * `requireOrgMembership` runs first so a caller with no organization is refused
 * once, here, rather than in four separate handlers.
 */
router.use(userAuth);
router.use(requireOrgMembership);

router.post("/", createAnnotation);

router.get("/meeting/:meetingId", requireOrgAccess(Meeting), listAnnotations);

router.put("/:id", updateAnnotation);
router.delete("/:id", deleteAnnotation);
router.patch("/:id/resolve", resolveAnnotation);

export default router;
