import express from 'express';
const router = express.Router();

import {
    createStakeholder,
    getStakeholders,
    logInteraction,
    updateStakeholder,
    getStakeholderAnalytics
} from '../controllers/stakeholderController.js';

import { protect } from '../middleware/authMiddleware.js';

router.use(protect);

router.route('/analytics/dashboard').get(getStakeholderAnalytics);

router.route('/')
    .post(createStakeholder)
    .get(getStakeholders);

router.route('/:id')
    .put(updateStakeholder);

router.route('/:id/interactions')
    .post(logInteraction);

export default router;
