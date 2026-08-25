import Stakeholder from '../models/stakeholderModel.js';

// @desc    Create Stakeholder
// @route   POST /api/stakeholders
// @access  Private
export const createStakeholder = async (req, res) => {
    try {
        const organizationId = req.user.organizationId || req.body.organizationId;
        const stakeholder = await Stakeholder.create({ ...req.body, organizationId });
        res.status(201).json({ success: true, data: stakeholder });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// @desc    Get all Stakeholders
// @route   GET /api/stakeholders
// @access  Private
export const getStakeholders = async (req, res) => {
    try {
        const organizationId = req.user.organizationId;
        const { category, tier, riskLevel } = req.query;

        let query = { organizationId };
        if (category) query.category = category;
        if (tier) query.tier = tier;
        if (riskLevel) query.riskLevel = riskLevel;

        const stakeholders = await Stakeholder.find(query)
            .populate('accountManager', 'firstName lastName avatar email')
            .sort({ relationshipHealth: 1 }); // surface lowest health first for awareness

        res.status(200).json({ success: true, count: stakeholders.length, data: stakeholders });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Log new interaction with Stakeholder
// @route   POST /api/stakeholders/:id/interactions
// @access  Private
export const logInteraction = async (req, res) => {
    try {
        const { meetingId, sentimentScore, engagementLevel, notes } = req.body;
        const stakeholder = await Stakeholder.findById(req.params.id);

        if (!stakeholder) {
            return res.status(404).json({ success: false, error: 'Stakeholder not found' });
        }

        stakeholder.interactions.push({ meetingId, sentimentScore, engagementLevel, notes });
        stakeholder.totalMeetings = stakeholder.totalMeetings + 1;
        await stakeholder.save(); // Pre-save hook recalculates health

        res.status(200).json({ success: true, data: stakeholder });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// @desc    Update Stakeholder
// @route   PUT /api/stakeholders/:id
// @access  Private
export const updateStakeholder = async (req, res) => {
    try {
        const stakeholder = await Stakeholder.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        }).populate('accountManager', 'firstName lastName avatar');

        if (!stakeholder) return res.status(404).json({ success: false, error: 'Stakeholder not found' });
        res.status(200).json({ success: true, data: stakeholder });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// @desc    Get Stakeholder Dashboard Analytics
// @route   GET /api/stakeholders/analytics/dashboard
// @access  Private
export const getStakeholderAnalytics = async (req, res) => {
    try {
        const organizationId = req.user.organizationId;
        const stakeholders = await Stakeholder.find({ organizationId });

        const total = stakeholders.length;
        let atRisk = 0;
        let strategicCount = 0;
        let totalMeetingsInvested = 0;
        let avgHealth = 0;

        const categoryBreakdown = {};
        const riskMatrix = [];
        const healthTrend = [];

        stakeholders.forEach(s => {
            if (s.riskLevel === 'critical' || s.riskLevel === 'high') atRisk++;
            if (s.tier === 'strategic') strategicCount++;
            totalMeetingsInvested += s.totalMeetings || 0;
            avgHealth += s.relationshipHealth || 0;

            categoryBreakdown[s.category] = (categoryBreakdown[s.category] || 0) + 1;

            riskMatrix.push({
                name: s.name,
                company: s.company,
                health: s.relationshipHealth,
                risk: s.riskLevel,
                meetings: s.totalMeetings
            });

            if (s.lastInteraction) {
                healthTrend.push({
                    name: s.name,
                    date: s.lastInteraction,
                    health: s.relationshipHealth
                });
            }
        });

        avgHealth = total > 0 ? Math.round(avgHealth / total) : 0;

        const categoryData = Object.keys(categoryBreakdown).map(k => ({
            name: k,
            count: categoryBreakdown[k]
        }));

        // Sort risk matrix — critical first
        const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        riskMatrix.sort((a, b) => riskOrder[a.risk] - riskOrder[b.risk]);

        res.status(200).json({
            success: true,
            data: {
                total,
                atRisk,
                strategicCount,
                totalMeetingsInvested,
                avgHealth,
                categoryData,
                riskMatrix: riskMatrix.slice(0, 15),
                healthTrend: healthTrend.slice(0, 12)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};
