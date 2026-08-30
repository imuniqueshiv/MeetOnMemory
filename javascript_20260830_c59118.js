import icebreakerService from '../services/icebreakerService.js';
import Icebreaker from '../models/Icebreaker.js';
import logger from '../utils/logger.js';
import { emitIcebreakerEvent } from '../socket/icebreakerSocket.js';

/**
 * Generate a new icebreaker for a meeting
 */
export const generateIcebreaker = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { type, difficulty, context } = req.body;
    const organizationId = req.user.organizationId;

    if (!meetingId) {
      return res.status(400).json({ error: 'Meeting ID is required' });
    }

    const icebreaker = await icebreakerService.generateIcebreaker(
      meetingId,
      organizationId,
      { type, difficulty, context }
    );

    // Emit socket event for real-time updates
    emitIcebreakerEvent(meetingId, 'icebreaker_generated', icebreaker);

    res.status(201).json({
      success: true,
      data: icebreaker,
      message: 'Icebreaker generated successfully',
    });
  } catch (error) {
    logger.error('Generate icebreaker error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate icebreaker',
    });
  }
};

/**
 * Select and activate an icebreaker for a meeting
 */
export const selectIcebreaker = async (req, res) => {
  try {
    const { icebreakerId } = req.params;
    const { meetingId } = req.body;

    if (!icebreakerId || !meetingId) {
      return res.status(400).json({ error: 'Icebreaker ID and Meeting ID are required' });
    }

    const icebreaker = await icebreakerService.selectIcebreaker(icebreakerId, meetingId);

    // Emit socket event
    emitIcebreakerEvent(meetingId, 'icebreaker_selected', icebreaker);

    res.status(200).json({
      success: true,
      data: icebreaker,
      message: 'Icebreaker selected and activated',
    });
  } catch (error) {
    logger.error('Select icebreaker error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to select icebreaker',
    });
  }
};

/**
 * Get active icebreaker for a meeting
 */
export const getActiveIcebreaker = async (req, res) => {
  try {
    const { meetingId } = req.params;

    if (!meetingId) {
      return res.status(400).json({ error: 'Meeting ID is required' });
    }

    const icebreaker = await icebreakerService.getActiveIcebreaker(meetingId);

    if (!icebreaker) {
      return res.status(404).json({
        success: false,
        error: 'No active icebreaker found for this meeting',
      });
    }

    res.status(200).json({
      success: true,
      data: icebreaker,
    });
  } catch (error) {
    logger.error('Get active icebreaker error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get active icebreaker',
    });
  }
};

/**
 * Submit a response to an icebreaker
 */
export const submitResponse = async (req, res) => {
  try {
    const { icebreakerId } = req.params;
    const { answer } = req.body;
    const userId = req.user.id;

    if (!icebreakerId) {
      return res.status(400).json({ error: 'Icebreaker ID is required' });
    }

    if (!answer) {
      return res.status(400).json({ error: 'Answer is required' });
    }

    const icebreaker = await icebreakerService.submitResponse(icebreakerId, userId, answer);

    // Emit socket event
    emitIcebreakerEvent(icebreaker.meetingId, 'icebreaker_response', {
      icebreakerId,
      userId,
      answer,
      responseCount: icebreaker.responses.length,
    });

    res.status(200).json({
      success: true,
      data: {
        icebreakerId,
        responseCount: icebreaker.responses.length,
        hasResponded: true,
      },
      message: 'Response submitted successfully',
    });
  } catch (error) {
    logger.error('Submit response error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to submit response',
    });
  }
};

/**
 * Get icebreaker history for a meeting
 */
export const getMeetingHistory = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { limit = 10, status } = req.query;

    if (!meetingId) {
      return res.status(400).json({ error: 'Meeting ID is required' });
    }

    const history = await icebreakerService.getMeetingHistory(meetingId, {
      limit: parseInt(limit),
      status,
    });

    res.status(200).json({
      success: true,
      data: history,
      count: history.length,
    });
  } catch (error) {
    logger.error('Get meeting history error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get meeting history',
    });
  }
};

/**
 * Get icebreaker statistics for an organization
 */
export const getOrganizationStats = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { startDate, endDate } = req.query;

    const stats = await icebreakerService.getOrganizationStats(organizationId, {
      startDate,
      endDate,
    });

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Get organization stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get organization stats',
    });
  }
};

/**
 * Get available icebreaker types
 */
export const getAvailableTypes = async (req, res) => {
  try {
    const types = [
      { value: 'fun_fact', label: 'Fun Fact', description: 'Share an interesting fact' },
      { value: 'would_you_rather', label: 'Would You Rather', description: 'Choose between two options' },
      { value: 'two_truths_one_lie', label: 'Two Truths One Lie', description: 'Find the lie' },
      { value: 'icebreaker_question', label: 'Icebreaker Question', description: 'Get to know each other' },
      { value: 'word_association', label: 'Word Association', description: 'Connect words' },
      { value: 'quick_poll', label: 'Quick Poll', description: 'Vote on preferences' },
      { value: 'brain_teaser', label: 'Brain Teaser', description: 'Solve a riddle' },
    ];

    res.status(200).json({
      success: true,
      data: types,
    });
  } catch (error) {
    logger.error('Get available types error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get available types',
    });
  }
};

/**
 * Auto-schedule icebreakers for a meeting
 */
export const autoScheduleIcebreakers = async (req, res) => {
  try {
    const { meetingId } = req.params;

    if (!meetingId) {
      return res.status(400).json({ error: 'Meeting ID is required' });
    }

    const icebreakers = await icebreakerService.autoScheduleIcebreakers(meetingId);

    res.status(200).json({
      success: true,
      data: icebreakers,
      message: 'Icebreakers auto-scheduled successfully',
    });
  } catch (error) {
    logger.error('Auto-schedule icebreakers error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to auto-schedule icebreakers',
    });
  }
};

/**
 * Delete an icebreaker
 */
export const deleteIcebreaker = async (req, res) => {
  try {
    const { icebreakerId } = req.params;

    if (!icebreakerId) {
      return res.status(400).json({ error: 'Icebreaker ID is required' });
    }

    const icebreaker = await Icebreaker.findById(icebreakerId);
    if (!icebreaker) {
      return res.status(404).json({ error: 'Icebreaker not found' });
    }

    await icebreaker.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Icebreaker deleted successfully',
    });
  } catch (error) {
    logger.error('Delete icebreaker error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete icebreaker',
    });
  }
};

/**
 * Get icebreaker response summary
 */
export const getResponseSummary = async (req, res) => {
  try {
    const { icebreakerId } = req.params;

    if (!icebreakerId) {
      return res.status(400).json({ error: 'Icebreaker ID is required' });
    }

    const icebreaker = await Icebreaker.findById(icebreakerId)
      .populate('responses.userId', 'name email avatar');

    if (!icebreaker) {
      return res.status(404).json({ error: 'Icebreaker not found' });
    }

    // Aggregate responses
    const summary = {
      totalResponses: icebreaker.responses.length,
      uniqueRespondents: new Set(icebreaker.responses.map(r => r.userId._id.toString())).size,
      responseDistribution: {},
      topAnswers: [],
    };

    if (icebreaker.options && icebreaker.options.length > 0) {
      // For poll/quiz type
      const counts = {};
      icebreaker.responses.forEach(r => {
        const answer = String(r.answer);
        counts[answer] = (counts[answer] || 0) + 1;
      });

      summary.responseDistribution = counts;
      summary.topAnswers = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([answer, count]) => ({ answer, count }));
    }

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error('Get response summary error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get response summary',
    });
  }
};