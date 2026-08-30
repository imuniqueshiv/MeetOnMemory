import { describe, it, before, after, beforeEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import mongoose from 'mongoose';
import Icebreaker from '../models/Icebreaker.js';
import icebreakerService from '../services/icebreakerService.js';
import * as aiIcebreaker from '../utils/aiIcebreaker.js';

describe('Icebreaker Service Tests', () => {
  let testMeetingId;
  let testOrganizationId;
  let testUserId;

  before(async () => {
    // Connect to test database
    await mongoose.connect(process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/test_meetonmemory');
    
    // Create test data
    testMeetingId = new mongoose.Types.ObjectId();
    testOrganizationId = new mongoose.Types.ObjectId();
    testUserId = new mongoose.Types.ObjectId();
  });

  after(async () => {
    // Clean up
    await Icebreaker.deleteMany({});
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    // Clear collections before each test
    await Icebreaker.deleteMany({});
  });

  describe('generateIcebreaker', () => {
    it('should generate an icebreaker using AI', async () => {
      const stub = sinon.stub(aiIcebreaker, 'generateIcebreakerWithAI');
      stub.resolves({
        question: 'Test question?',
        options: ['Option A', 'Option B'],
        tags: ['test'],
        difficulty: 'easy',
        metadata: { category: 'test' },
      });

      const result = await icebreakerService.generateIcebreaker(
        testMeetingId,
        testOrganizationId,
        { type: 'icebreaker_question' }
      );

      expect(result).to.have.property('_id');
      expect(result.question).to.equal('Test question?');
      expect(result.status).to.equal('draft');
      
      stub.restore();
    });

    it('should handle missing meeting gracefully', async () => {
      try {
        await icebreakerService.generateIcebreaker(
          new mongoose.Types.ObjectId(),
          testOrganizationId
        );
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Meeting not found');
      }
    });
  });

  describe('selectIcebreaker', () => {
    it('should activate an icebreaker', async () => {
      // Create a test icebreaker
      const icebreaker = new Icebreaker({
        meetingId: testMeetingId,
        organizationId: testOrganizationId,
        type: 'icebreaker_question',
        question: 'Test question',
        status: 'draft',
      });
      await icebreaker.save();

      const result = await icebreakerService.selectIcebreaker(
        icebreaker._id,
        testMeetingId
      );

      expect(result.status).to.equal('active');
      expect(result.displayedAt).to.be.a('date');
      expect(result.expiresAt).to.be.a('date');
    });

    it('should deactivate previous active icebreakers', async () => {
      // Create two icebreakers
      const icebreaker1 = new Icebreaker({
        meetingId: testMeetingId,
        organizationId: testOrganizationId,
        type: 'icebreaker_question',
        question: 'First question',
        status: 'active',
      });
      await icebreaker1.save();

      const icebreaker2 = new Icebreaker({
        meetingId: testMeetingId,
        organizationId: testOrganizationId,
        type: 'icebreaker_question',
        question: 'Second question',
        status: 'draft',
      });
      await icebreaker2.save();

      await icebreakerService.selectIcebreaker(icebreaker2._id, testMeetingId);

      const updated1 = await Icebreaker.findById(icebreaker1._id);
      const updated2 = await Icebreaker.findById(icebreaker2._id);

      expect(updated1.status).to.equal('expired');
      expect(updated2.status).to.equal('active');
    });
  });

  describe('submitResponse', () => {
    it('should add a response to an icebreaker', async () => {
      const icebreaker = new Icebreaker({
        meetingId: testMeetingId,
        organizationId: testOrganizationId,
        type: 'icebreaker_question',
        question: 'Test question',
        status: 'active',
        expiresAt: new Date(Date.now() + 60000),
      });
      await icebreaker.save();

      const result = await icebreakerService.submitResponse(
        icebreaker._id,
        testUserId,
        'Test answer'
      );

      expect(result.responses).to.have.lengthOf(1);
      expect(result.responses[0].userId.toString()).to.equal(testUserId.toString());
      expect(result.responses[0].answer).to.equal('Test answer');
    });

    it('should prevent duplicate responses from same user', async () => {
      const icebreaker = new Icebreaker({
        meetingId: testMeetingId,
        organizationId: testOrganizationId,
        type: 'icebreaker_question',
        question: 'Test question',
        status: 'active',
        expiresAt: new Date(Date.now() + 60000),
        responses: [
          { userId: testUserId, answer: 'First answer' },
        ],
      });
      await icebreaker.save();

      const result = await icebreakerService.submitResponse(
        icebreaker._id,
        testUserId,
        'Updated answer'
      );

      expect(result.responses).to.have.lengthOf(1);
      expect(result.responses[0].answer).to.equal('Updated answer');
    });

    it('should reject responses to expired icebreakers', async () => {
      const icebreaker = new Icebreaker({
        meetingId: testMeetingId,
        organizationId: testOrganizationId,
        type: 'icebreaker_question',
        question: 'Test question',
        status: 'active',
        expiresAt: new Date(Date.now() - 1000),
      });
      await icebreaker.save();

      try {
        await icebreakerService.submitResponse(
          icebreaker._id,
          testUserId,
          'Test answer'
        );
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('expired');
      }
    });
  });

  describe('getActiveIcebreaker', () => {
    it('should return the active icebreaker for a meeting', async () => {
      const icebreaker = new Icebreaker({
        meetingId: testMeetingId,
        organizationId: testOrganizationId,
        type: 'icebreaker_question',
        question: 'Active question',
        status: 'active',
        expiresAt: new Date(Date.now() + 60000),
      });
      await icebreaker.save();

      const result = await icebreakerService.getActiveIcebreaker(testMeetingId);
      expect(result._id.toString()).to.equal(icebreaker._id.toString());
    });

    it('should return null if no active icebreaker exists', async () => {
      const result = await icebreakerService.getActiveIcebreaker(testMeetingId);
      expect(result).to.be.null;
    });
  });

  describe('getMeetingHistory', () => {
    it('should return icebreaker history for a meeting', async () => {
      // Create multiple icebreakers
      for (let i = 0; i < 5; i++) {
        await new Icebreaker({
          meetingId: testMeetingId,
          organizationId: testOrganizationId,
          type: 'icebreaker_question',
          question: `Question ${i}`,
          status: i % 2 === 0 ? 'active' : 'answered',
          expiresAt: new Date(Date.now() + 60000),
        }).save();
      }

      const history = await icebreakerService.getMeetingHistory(testMeetingId);
      expect(history).to.have.lengthOf.at.least(5);
    });

    it('should filter by status', async () => {
      // Create active and answered icebreakers
      await new Icebreaker({
        meetingId: testMeetingId,
        organizationId: testOrganizationId,
        type: 'icebreaker_question',
        question: 'Active one',
        status: 'active',
        expiresAt: new Date(Date.now() + 60000),
      }).save();

      await new Icebreaker({
        meetingId: testMeetingId,
        organizationId: testOrganizationId,
        type: 'icebreaker_question',
        question: 'Answered one',
        status: 'answered',
        expiresAt: new Date(Date.now() + 60000),
      }).save();

      const activeHistory = await icebreakerService.getMeetingHistory(
        testMeetingId,
        { status: 'active' }
      );
      expect(activeHistory).to.have.lengthOf(1);
      expect(activeHistory[0].status).to.equal('active');
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await new Icebreaker({
          meetingId: testMeetingId,
          organizationId: testOrganizationId,
          type: 'icebreaker_question',
          question: `Question ${i}`,
          status: 'answered',
        }).save();
      }

      const history = await icebreakerService.getMeetingHistory(
        testMeetingId,
        { limit: 3 }
      );
      expect(history).to.have.lengthOf(3);
    });
  });

  describe('getOrganizationStats', () => {
    it('should return stats for an organization', async () => {
      for (let i = 0; i < 10; i++) {
        await new Icebreaker({
          meetingId: new mongoose.Types.ObjectId(),
          organizationId: testOrganizationId,
          type: i % 2 === 0 ? 'fun_fact' : 'icebreaker_question',
          question: `Question ${i}`,
          status: i < 7 ? 'active' : 'answered',
          expiresAt: new Date(Date.now() + 60000),
          responses: i < 5 ? [{ userId: testUserId, answer: 'test' }] : [],
        }).save();
      }

      const stats = await icebreakerService.getOrganizationStats(testOrganizationId);
      expect(stats.total).to.equal(10);
      expect(stats.active).to.equal(7);
      expect(stats.byType).to.have.lengthOf(2);
    });

    it('should filter by date range', async () => {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const lastWeek = new Date(now);
      lastWeek.setDate(lastWeek.getDate() - 7);

      await new Icebreaker({
        meetingId: new mongoose.Types.ObjectId(),
        organizationId: testOrganizationId,
        type: 'icebreaker_question',
        question: 'Recent question',
        status: 'active',
        createdAt: now,
      }).save();

      await new Icebreaker({
        meetingId: new mongoose.Types.ObjectId(),
        organizationId: testOrganizationId,
        type: 'icebreaker_question',
        question: 'Old question',
        status: 'active',
        createdAt: lastWeek,
      }).save();

      const stats = await icebreakerService.getOrganizationStats(
        testOrganizationId,
        { startDate: yesterday }
      );
      expect(stats.total).to.equal(1);
      expect(stats.byType[0].count).to.equal(1);
    });
  });
});