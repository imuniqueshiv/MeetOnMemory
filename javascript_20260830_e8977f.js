import express from 'express';
import {
  generateIcebreaker,
  selectIcebreaker,
  getActiveIcebreaker,
  submitResponse,
  getMeetingHistory,
  getOrganizationStats,
  getAvailableTypes,
  autoScheduleIcebreakers,
  deleteIcebreaker,
  getResponseSummary,
} from '../controllers/icebreakerController.js';
import { authenticateUser, requireOrganization } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateUser);
router.use(requireOrganization);

/**
 * @route   GET /api/icebreakers/types
 * @desc    Get available icebreaker types
 * @access  Private
 */
router.get('/types', getAvailableTypes);

/**
 * @route   POST /api/icebreakers/meeting/:meetingId/generate
 * @desc    Generate a new icebreaker for a meeting
 * @access  Private
 */
router.post('/meeting/:meetingId/generate', generateIcebreaker);

/**
 * @route   POST /api/icebreakers/meeting/:meetingId/auto-schedule
 * @desc    Auto-schedule icebreakers for a meeting
 * @access  Private
 */
router.post('/meeting/:meetingId/auto-schedule', autoScheduleIcebreakers);

/**
 * @route   GET /api/icebreakers/meeting/:meetingId/active
 * @desc    Get active icebreaker for a meeting
 * @access  Private
 */
router.get('/meeting/:meetingId/active', getActiveIcebreaker);

/**
 * @route   GET /api/icebreakers/meeting/:meetingId/history
 * @desc    Get icebreaker history for a meeting
 * @access  Private
 */
router.get('/meeting/:meetingId/history', getMeetingHistory);

/**
 * @route   POST /api/icebreakers/:icebreakerId/select
 * @desc    Select and activate an icebreaker
 * @access  Private
 */
router.post('/:icebreakerId/select', selectIcebreaker);

/**
 * @route   POST /api/icebreakers/:icebreakerId/respond
 * @desc    Submit a response to an icebreaker
 * @access  Private
 */
router.post('/:icebreakerId/respond', submitResponse);

/**
 * @route   GET /api/icebreakers/:icebreakerId/summary
 * @desc    Get response summary for an icebreaker
 * @access  Private
 */
router.get('/:icebreakerId/summary', getResponseSummary);

/**
 * @route   DELETE /api/icebreakers/:icebreakerId
 * @desc    Delete an icebreaker
 * @access  Private
 */
router.delete('/:icebreakerId', deleteIcebreaker);

/**
 * @route   GET /api/icebreakers/stats/organization
 * @desc    Get icebreaker statistics for organization
 * @access  Private
 */
router.get('/stats/organization', getOrganizationStats);

export default router;