import Stakeholder from '../models/stakeholderModel.js';

// @desc    Create Stakeholder
// @route   POST /api/stakeholders
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
export const getStakeholders = async (req, res) => {
    try {
        const organizationId = req.user.organizationId;
        const { category, riskLevel, tier, search } = req.query;

        let query = { organizationId };
        if (category) query.category = category;
        if (riskLevel) query.riskLevel = riskLevel;
        if (tier) query.tier = tier;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { company: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const stakeholders = await Stakeholder.find(query)
            .populate('primaryContact', 'firstName lastName avatar email')
            .populate('interactions.meetingId', 'title date')
            .sort({ healthScore: 1 }); // worst health first

        res.status(200).json({ success: true, count: stakeholders.length, data: stakeholders });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Get single Stakeholder
// @route   GET /api/stakeholders/:id
export const getStakeholder = async (req, res) => {
    try {
        const stakeholder = await Stakeholder.findById(req.params.id)
            .populate('primaryContact', 'firstName lastName avatar email')
            .populate('interactions.meetingId', 'title date duration')
            .populate('interactions.recordedBy', 'firstName lastName avatar');

        if (!stakeholder) {
            return res.status(404).json({ success: false, error: 'Stakeholder not found' });
        }
        res.status(200).json({ success: true, data: stakeholder });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Update Stakeholder
// @route   PUT /api/stakeholders/:id
export const updateStakeholder = async (req, res) => {
    try {
        const stakeholder = await Stakeholder.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        ).populate('primaryContact', 'firstName lastName avatar email');

        if (!stakeholder) {
            return res.status(404).json({ success: false, error: 'Stakeholder not found' });
        }
        res.status(200).json({ success: true, data: stakeholder });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// @desc    Delete Stakeholder
// @route   DELETE /api/stakeholders/:id
export const deleteStakeholder = async (req, res) => {
    try {
        const stakeholder = await Stakeholder.findByIdAndDelete(req.params.id);
        if (!stakeholder) {
            return res.status(404).json({ success: false, error: 'Stakeholder not found' });
        }
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Log an interaction for a stakeholder
// @route   POST /api/stakeholders/:id/interactions
export const logInteraction = async (req, res) => {
    try {
        const stakeholder = await Stakeholder.findById(req.params.id);
        if (!stakeholder) {
            return res.status(404).json({ success: false, error: 'Stakeholder not found' });
        }

        const interaction = {
            meetingId: req.body.meetingId,
            type: req.body.type,
            sentiment: req.body.sentiment,
            engagement: req.body.engagement,
            summary: req.body.summary,
            actionItems: req.body.actionItems,
            recordedBy: req.user._id
        };

        stakeholder.interactions.push(interaction);
        stakeholder.lastInteractionDate = new Date();
        stakeholder.totalMeetingsAttended += (req.body.type === 'meeting') ? 1 : 0;

        await stakeholder.save(); // triggers pre-save health recalculation

        res.status(200).json({ success: true, data: stakeholder });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// @desc    Get Stakeholder Analytics Dashboard
// @route   GET /api/stakeholders/analytics/dashboard
export const getStakeholderAnalytics = async (req, res) => {
    try {
        const organizationId = req.user.organizationId;
        const stakeholders = await Stakeholder.find({ organizationId });

        const total = stakeholders.length;
        const atRisk = stakeholders.filter(s => s.riskLevel === 'high' || s.riskLevel === 'critical').length;
        const strategic = stakeholders.filter(s => s.tier === 'strategic').length;
        const avgHealth = total > 0
            ? Math.round(stakeholders.reduce((sum, s) => sum + s.healthScore, 0) / total)
            : 0;

        // Category breakdown for horizontal bar chart
        const categoryMap = { client: 0, vendor: 0, partner: 0, investor: 0 };
        stakeholders.forEach(s => {
            if (categoryMap[s.category] !== undefined) categoryMap[s.category]++;
        });
        const categoryBreakdown = Object.entries(categoryMap).map(([name, count]) => ({ name, count }));

        // Health vs engagement scatter data
        const scatterData = stakeholders.map(s => ({
            name: s.name,
            health: s.healthScore,
            engagement: s.totalMeetingsAttended,
            risk: s.riskLevel,
            category: s.category
        }));

        // Risk distribution
        const riskMap = { low: 0, medium: 0, high: 0, critical: 0 };
        stakeholders.forEach(s => { riskMap[s.riskLevel]++; });
        const riskDistribution = Object.entries(riskMap).map(([name, count]) => ({ name, count }));

        res.status(200).json({
            success: true,
            data: {
                total,
                atRisk,
                strategic,
                avgHealth,
                categoryBreakdown,
                scatterData,
                riskDistribution
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};
