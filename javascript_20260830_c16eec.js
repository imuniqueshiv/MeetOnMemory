import Icebreaker from '../models/Icebreaker.js';
import Meeting from '../models/Meeting.js';
import { generateIcebreakerWithAI } from '../utils/aiIcebreaker.js';
import logger from '../utils/logger.js';

class IcebreakerService {
  /**
   * Generate an icebreaker using AI
   */
  async generateIcebreaker(meetingId, organizationId, options = {}) {
    try {
      // Fetch meeting context
      const meeting = await Meeting.findById(meetingId);
      if (!meeting) {
        throw new Error('Meeting not found');
      }

      // Generate with AI
      const aiResponse = await generateIcebreakerWithAI(meeting, options);

      // Create icebreaker record
      const icebreaker = new Icebreaker({
        meetingId,
        organizationId,
        type: options.type || 'icebreaker_question',
        question: aiResponse.question,
        options: aiResponse.options || [],
        generatedBy: 'ai',
        status: 'draft',
        difficulty: options.difficulty || 'medium',
        tags: aiResponse.tags || [],
        metadata: {
          generatedAt: new Date(),
          meetingTitle: meeting.title,
          ...aiResponse.metadata,
        },
      });

      await icebreaker.save();
      logger.info(`Icebreaker generated for meeting ${meetingId}`);

      return icebreaker;
    } catch (error) {
      logger.error('Error generating icebreaker:', error);
      throw error;
    }
  }

  /**
   * Select an icebreaker for a meeting
   */
  async selectIcebreaker(icebreakerId, meetingId) {
    try {
      // Deactivate any existing active icebreakers
      await Icebreaker.updateMany(
        { meetingId, status: 'active' },
        { status: 'expired' }
      );

      // Activate the selected one
      const icebreaker = await Icebreaker.findByIdAndUpdate(
        icebreakerId,
        {
          status: 'active',
          displayedAt: new Date(),
          expiresAt: new Date(Date.now() + 60000), // 60 seconds default
        },
        { new: true }
      );

      if (!icebreaker) {
        throw new Error('Icebreaker not found');
      }

      logger.info(`Icebreaker ${icebreakerId} activated for meeting ${meetingId}`);
      return icebreaker;
    } catch (error) {
      logger.error('Error selecting icebreaker:', error);
      throw error;
    }
  }

  /**
   * Get active icebreaker for a meeting
   */
  async getActiveIcebreaker(meetingId) {
    try {
      const icebreaker = await Icebreaker.getActiveForMeeting(meetingId);
      return icebreaker;
    } catch (error) {
      logger.error('Error getting active icebreaker:', error);
      throw error;
    }
  }

  /**
   * Submit a response to an icebreaker
   */
  async submitResponse(icebreakerId, userId, answer) {
    try {
      const icebreaker = await Icebreaker.findById(icebreakerId);
      if (!icebreaker) {
        throw new Error('Icebreaker not found');
      }

      if (icebreaker.status !== 'active') {
        throw new Error('Icebreaker is not active');
      }

      if (icebreaker.expiresAt && new Date() > icebreaker.expiresAt) {
        throw new Error('Icebreaker has expired');
      }

      icebreaker.addResponse(userId, answer);
      await icebreaker.save();

      // Check if all participants have responded
      const meeting = await Meeting.findById(icebreaker.meetingId);
      if (meeting) {
        const participantCount = meeting.participants?.length || 0;
        const responseCount = icebreaker.responses.length;

        if (responseCount >= participantCount && participantCount > 0) {
          icebreaker.status = 'answered';
          await icebreaker.save();
        }
      }

      logger.info(`Response submitted for icebreaker ${icebreakerId} by user ${userId}`);
      return icebreaker;
    } catch (error) {
      logger.error('Error submitting response:', error);
      throw error;
    }
  }

  /**
   * Get icebreaker history for a meeting
   */
  async getMeetingHistory(meetingId, options = {}) {
    try {
      const { limit = 10, status = null } = options;
      const query = { meetingId };

      if (status) {
        query.status = status;
      }

      const icebreakers = await Icebreaker.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('responses.userId', 'name email');

      return icebreakers;
    } catch (error) {
      logger.error('Error getting icebreaker history:', error);
      throw error;
    }
  }

  /**
   * Get icebreaker statistics for an organization
   */
  async getOrganizationStats(organizationId, options = {}) {
    try {
      const { startDate, endDate } = options;
      const match = { organizationId };

      if (startDate || endDate) {
        match.createdAt = {};
        if (startDate) match.createdAt.$gte = new Date(startDate);
        if (endDate) match.createdAt.$lte = new Date(endDate);
      }

      const stats = await Icebreaker.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            totalResponses: { $sum: { $size: '$responses' } },
            avgResponses: { $avg: { $size: '$responses' } },
          },
        },
      ]);

      const total = await Icebreaker.countDocuments(match);
      const active = await Icebreaker.countDocuments({ ...match, status: 'active' });

      return {
        total,
        active,
        byType: stats,
        engagementRate: total > 0 ? (active / total) * 100 : 0,
      };
    } catch (error) {
      logger.error('Error getting organization stats:', error);
      throw error;
    }
  }

  /**
   * Auto-schedule icebreakers for recurring meetings
   */
  async autoScheduleIcebreakers(meetingId) {
    try {
      const meeting = await Meeting.findById(meetingId);
      if (!meeting || meeting.recurring !== 'weekly') {
        return null;
      }

      // Generate a week's worth of icebreakers
      const types = ['fun_fact', 'would_you_rather', 'two_truths_one_lie'];
      const icebreakers = [];

      for (let i = 0; i < 3; i++) {
        const type = types[i % types.length];
        const icebreaker = await this.generateIcebreaker(meetingId, meeting.organizationId, {
          type,
          difficulty: 'easy',
        });
        icebreakers.push(icebreaker);
      }

      logger.info(`Auto-scheduled ${icebreakers.length} icebreakers for meeting ${meetingId}`);
      return icebreakers;
    } catch (error) {
      logger.error('Error auto-scheduling icebreakers:', error);
      throw error;
    }
  }
}

export default new IcebreakerService();