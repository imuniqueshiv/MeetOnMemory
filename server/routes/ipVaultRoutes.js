import express from 'express';
const router = express.Router();

import {
    createIpIdea,
    getIpIdeas,
    getIpAnalytics,
    updateIpIdea
} from '../controllers/ipVaultController.js';

import { protect } from '../middleware/authMiddleware.js';

router.use(protect);

router.route('/analytics/dashboard').get(getIpAnalytics);

router.route('/')
    .post(createIpIdea)
    .get(getIpIdeas);

router.route('/:id')
    .put(updateIpIdea);

export default router;
