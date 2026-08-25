import IpVault from '../models/ipVaultModel.js';
import Meeting from '../models/meetingModel.js';

// @desc    Create new IP Concept
// @route   POST /api/v1/ip-vault
// @access  Private
export const createIpIdea = async (req, res) => {
    try {
        const { conceptName, description, originMeetingId, inventors, techDomain, tags } = req.body;
        const organizationId = req.user.organizationId || req.body.organizationId;

        const ipIdea = await IpVault.create({
            organizationId,
            conceptName,
            description,
            originMeetingId,
            inventors: inventors || [req.user._id],
            techDomain,
            tags
        });

        res.status(201).json({ success: true, data: ipIdea });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

// @desc    Get all IP Concepts for Org
// @route   GET /api/v1/ip-vault
// @access  Private
export const getIpIdeas = async (req, res) => {
    try {
        const organizationId = req.user.organizationId;
        const { status, techDomain } = req.query;

        let query = { organizationId };
        if (status) query.status = status;
        if (techDomain) query.techDomain = techDomain;

        const ipIdeas = await IpVault.find(query)
            .populate('inventors', 'firstName lastName avatar email')
            .populate('originMeetingId', 'title date')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: ipIdeas.length, data: ipIdeas });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Get IP Analytics Dashboard
// @route   GET /api/v1/ip-vault/analytics/dashboard
// @access  Private
export const getIpAnalytics = async (req, res) => {
    try {
        const organizationId = req.user.organizationId;
        const items = await IpVault.find({ organizationId });

        let totalIp = items.length;
        let filedIp = 0;
        let highValueIp = 0;
        let domainDistribution = {};
        let readinessTimeline = [];

        items.forEach(item => {
            if (item.status === 'filed' || item.status === 'granted') filedIp++;
            if (item.patentabilityScore >= 80) highValueIp++;

            domainDistribution[item.techDomain] = (domainDistribution[item.techDomain] || 0) + 1;

            // Readiness data
            readinessTimeline.push({
                name: item.conceptName,
                score: item.patentabilityScore
            });
        });

        const domains = Object.keys(domainDistribution).map(key => ({
            name: key,
            value: domainDistribution[key]
        }));

        res.status(200).json({
            success: true,
            data: {
                totalIp,
                filedIp,
                highValueIp,
                domains,
                readinessTimeline: readinessTimeline.sort((a, b) => b.score - a.score).slice(0, 10)
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// @desc    Update IP Concept (e.g., status or score)
// @route   PUT /api/v1/ip-vault/:id
// @access  Private
export const updateIpIdea = async (req, res) => {
    try {
        let idea = await IpVault.findById(req.params.id);
        if (!idea) return res.status(404).json({ success: false, error: 'IP not found' });

        idea = await IpVault.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        }).populate('inventors', 'firstName lastName avatar');

        res.status(200).json({ success: true, data: idea });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};
