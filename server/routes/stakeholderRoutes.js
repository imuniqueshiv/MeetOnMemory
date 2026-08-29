import express from 'express';
const router = express.Router();
import {
    createStakeholder,
    getStakeholders,
    getStakeholder,
    updateStakeholder,
    deleteStakeholder,
    logInteraction,
    getStakeholderAnalytics
} from '../controllers/stakeholderController.js';
import { protect } from '../middleware/authMiddleware.js';

router.use(protect);

router.route('/analytics/dashboard').get(getStakeholderAnalytics);
router.route('/').post(createStakeholder).get(getStakeholders);
router.route('/:id').get(getStakeholder).put(updateStakeholder).delete(deleteStakeholder);
router.route('/:id/interactions').post(logInteraction);

export default router;
