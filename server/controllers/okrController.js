import OKR from '../models/okrModel.js';
import Meeting from '../models/meetingModel.js';

// @desc    Create a new OKR
// @route   POST /api/v1/okrs
// @access  Private
export const createOkr = async (req, res) => {
    try {
        const { objective, description, ownerId, quarter, keyResults, tags } = req.body;

        // Fallback to user's org if not specified
        const organizationId = req.user.organizationId || req.body.organizationId;

        const okr = await OKR.create({
            organizationId,
            objective,
            description,
            ownerId: ownerId || req.user._id, // default owner to creator
            quarter,
            keyResults,
            tags
        });

        res.status(201).json({
            success: true,
            data: okr
        });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// @desc    Get all OKRs for organization
// @route   GET /api/v1/okrs
// @access  Private
export const getOkrs = async (req, res) => {
    try {
        const organizationId = req.user.organizationId;
        const { quarter, status } = req.query;

        let query = { organizationId };

        if (quarter) query.quarter = quarter;
        if (status) query.status = status;

        const okrs = await OKR.find(query)
            .populate('ownerId', 'firstName lastName avatar email')
            .populate('associatedMeetings', 'title date duration status')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: okrs.length,
            data: okrs
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Get single OKR
// @route   GET /api/v1/okrs/:id
// @access  Private
export const getOkr = async (req, res) => {
    try {
        const okr = await OKR.findById(req.params.id)
            .populate('ownerId', 'firstName lastName avatar email')
            .populate('associatedMeetings', 'title date duration topics participants');

        if (!okr) {
            return res.status(404).json({ success: false, error: 'OKR not found' });
        }

        res.status(200).json({
            success: true,
            data: okr
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Update OKR Key Results
// @route   PUT /api/v1/okrs/:id/key-results
// @access  Private
export const updateKeyResults = async (req, res) => {
    try {
        const { keyResults } = req.body;
        let okr = await OKR.findById(req.params.id);

        if (!okr) {
            return res.status(404).json({ success: false, error: 'OKR not found' });
        }

        // Update matching key results by id, or add new if no id
        keyResults.forEach(updateKr => {
            if (updateKr._id) {
                const existingKr = okr.keyResults.id(updateKr._id);
                if (existingKr) {
                    existingKr.currentValue = updateKr.currentValue !== undefined ? updateKr.currentValue : existingKr.currentValue;
                    existingKr.status = updateKr.status || existingKr.status;
                    existingKr.title = updateKr.title || existingKr.title;
                }
            } else {
                okr.keyResults.push(updateKr);
            }
        });

        await okr.save();

        res.status(200).json({
            success: true,
            data: okr
        });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// @desc    Link meeting to OKR
// @route   POST /api/v1/okrs/:id/link-meeting
// @access  Private
export const linkMeeting = async (req, res) => {
    try {
        const { meetingId } = req.body;

        let okr = await OKR.findById(req.params.id);
        if (!okr) {
            return res.status(404).json({ success: false, error: 'OKR not found' });
        }

        const meeting = await Meeting.findById(meetingId);
        if (!meeting) {
            return res.status(404).json({ success: false, error: 'Meeting not found' });
        }

        // Check if already linked
        if (!okr.associatedMeetings.includes(meetingId)) {
            okr.associatedMeetings.push(meetingId);

            // Add meeting duration to OKR
            const durationHours = (meeting.duration || 60) / 60; // fallback 60 mins
            okr.totalMeetingHoursLinked += durationHours;

            await okr.save();
        }

        res.status(200).json({
            success: true,
            data: okr
        });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// @desc    Get OKR Alignment Dashboard Analytics
// @route   GET /api/v1/okrs/analytics/dashboard
// @access  Private
export const getOkrAnalytics = async (req, res) => {
    try {
        const organizationId = req.user.organizationId;

        const okrs = await OKR.find({ organizationId });

        // Aggregate overall progress
        const totalOkrs = okrs.length;
        let totalAlignmentScore = 0;
        let totalHoursInvested = 0;
        let onTrackCount = 0;
        let atRiskCount = 0;

        let timeInvestmentByObjective = [];

        okrs.forEach(okr => {
            totalAlignmentScore += okr.alignmentScore || 0;
            totalHoursInvested += okr.totalMeetingHoursLinked || 0;

            // Calculate okr overall status based on KRs
            const avgKrProgress = okr.alignmentScore;
            if (avgKrProgress >= 75) onTrackCount++;
            else if (avgKrProgress < 50) atRiskCount++;

            timeInvestmentByObjective.push({
                objective: okr.objective,
                hours: okr.totalMeetingHoursLinked || 0,
                progress: okr.alignmentScore || 0
            });
        });

        const averageAlignment = totalOkrs > 0 ? (totalAlignmentScore / totalOkrs) : 0;

        res.status(200).json({
            success: true,
            data: {
                totalOkrs,
                averageAlignment,
                totalHoursInvested,
                onTrackCount,
                atRiskCount,
                timeInvestmentByObjective: timeInvestmentByObjective.sort((a, b) => b.hours - a.hours).slice(0, 10) // Top 10 by effort
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};
