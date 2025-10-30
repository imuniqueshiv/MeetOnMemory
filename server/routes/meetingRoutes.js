import express from 'express';
import { createMeeting, getMyMeetings, getMeetingById } from '../controllers/meetingController.js';
import userAuth from '../middleware/userAuth.js'; // Import your auth middleware

const router = express.Router();

// --- Protected Routes ---
// userAuth middleware will run first, checking for a valid token
// If valid, it will attach the user object to 'req' (as 'req.user')

// POST /api/meetings
router.post('/', userAuth, createMeeting);

// GET /api/meetings
router.get('/', userAuth, getMyMeetings);

// GET /api/meetings/:id
router.get('/:id', userAuth, getMeetingById);


// We will add the AI processing route here later
// POST /api/meetings/:id/process-audio

export default router;