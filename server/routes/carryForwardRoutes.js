import express from 'express'
import userAuth from '../middleware/userAuth.js'
import { requireOrgMembership, requirePermission } from '../middleware/rbac.js'
import {
  getConfig,
  updateConfig,
  getPreview,
  applyCarryForward,
} from '../controllers/carryForwardController.js'

const router = express.Router()

// Enforce baseline authentication and organization membership across all carry-forward endpoints
router.use(userAuth)
router.use(requireOrgMembership)

// Configuration routes
router.get('/series/:seriesId/config', requirePermission('meetings', 'read'), getConfig)

router.put('/series/:seriesId/config', requirePermission('meetings', 'edit'), updateConfig)

// Preview route
router.get('/series/:seriesId/preview', requirePermission('meetings', 'read'), getPreview)

// Apply route
router.post('/series/:seriesId/apply', requirePermission('meetings', 'edit'), applyCarryForward)

export default router
