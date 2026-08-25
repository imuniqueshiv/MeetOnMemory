import express from 'express';
const router = express.Router();

import {
    createOkr,
    getOkrs,
    getOkr,
    updateKeyResults,
    linkMeeting,
    getOkrAnalytics
} from '../controllers/okrController.js';

// Middleware for authentication (Mocked/imported from typical location)
import { protect } from '../middleware/authMiddleware.js'; // Using authMiddleware.js which is standard in this project

// Run protect on all routes
router.use(protect);

router.route('/analytics/dashboard').get(getOkrAnalytics);

router.route('/')
    .post(createOkr)
    .get(getOkrs);

router.route('/:id')
    .get(getOkr);

router.route('/:id/key-results')
    .put(updateKeyResults);

router.route('/:id/link-meeting')
    .post(linkMeeting);

export default router;
