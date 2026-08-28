import express from "express";
import userAuth from "../middleware/userAuth.js";
import {
  createCustomRole,
  getCustomRoles,
  setResourceAclEntry,
  checkResourcePermission,
} from "../controllers/customRoleController.js";

const router = express.Router();

router.use(userAuth);

router.post("/roles", createCustomRole);
router.get("/roles", getCustomRoles);
router.post("/acl", setResourceAclEntry);
router.get("/check-permission", checkResourcePermission);

export default router;
