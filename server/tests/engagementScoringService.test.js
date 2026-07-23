import mongoose from "mongoose";
import Membership from "../models/membershipModel.js";
import {
  incrementEngagementScore,
  getLeaderboard,
  getMembershipEngagement,
} from "../services/engagementScoringService.js";

describe("EngagementScoringService", () => {
  let userId;
  let organizationId;

  beforeEach(() => {
    userId = new mongoose.Types.ObjectId();
    organizationId = new mongoose.Types.ObjectId();
  });

  describe("incrementEngagementScore", () => {
    it("should increment score for a valid action type", async () => {
      await Membership.create({
        user: userId,
        organization: organizationId,
        role: "member",
        status: "active",
      });

      const result = await incrementEngagementScore(
        userId,
        organizationId,
        "meetingsCreated",
      );

      expect(result).not.toBeNull();
      expect(result.engagementScore).toBe(10);
      expect(result.engagementBreakdown.meetingsCreated).toBe(1);
      expect(result.engagementBreakdown.lastActivityAt).toBeDefined();
    });

    it("should accumulate scores across multiple actions", async () => {
      await Membership.create({
        user: userId,
        organization: organizationId,
        role: "member",
        status: "active",
      });

      await incrementEngagementScore(userId, organizationId, "meetingsCreated");
      await incrementEngagementScore(
        userId,
        organizationId,
        "actionItemsResolved",
      );
      const result = await incrementEngagementScore(
        userId,
        organizationId,
        "policiesUploaded",
      );

      expect(result.engagementScore).toBe(10 + 12 + 15);
      expect(result.engagementBreakdown.meetingsCreated).toBe(1);
      expect(result.engagementBreakdown.actionItemsResolved).toBe(1);
      expect(result.engagementBreakdown.policiesUploaded).toBe(1);
    });

    it("should return null for unknown action type", async () => {
      const result = await incrementEngagementScore(
        userId,
        organizationId,
        "unknownAction",
      );

      expect(result).toBeNull();
    });

    it("should return null if userId is missing", async () => {
      const result = await incrementEngagementScore(
        null,
        organizationId,
        "meetingsCreated",
      );

      expect(result).toBeNull();
    });

    it("should return null if organizationId is missing", async () => {
      const result = await incrementEngagementScore(
        userId,
        null,
        "meetingsCreated",
      );

      expect(result).toBeNull();
    });

    it("should not affect other organizations' scores", async () => {
      const otherOrgId = new mongoose.Types.ObjectId();

      await Membership.create({
        user: userId,
        organization: organizationId,
        role: "member",
        status: "active",
      });
      await Membership.create({
        user: userId,
        organization: otherOrgId,
        role: "member",
        status: "active",
      });

      await incrementEngagementScore(userId, organizationId, "meetingsCreated");

      const thisOrgMembership = await Membership.findOne({
        user: userId,
        organization: organizationId,
      });
      const otherOrgMembership = await Membership.findOne({
        user: userId,
        organization: otherOrgId,
      });

      expect(thisOrgMembership.engagementScore).toBe(10);
      expect(otherOrgMembership.engagementScore).toBe(0);
    });

    it("should not update suspended or removed memberships", async () => {
      await Membership.create({
        user: userId,
        organization: organizationId,
        role: "member",
        status: "suspended",
      });

      const result = await incrementEngagementScore(
        userId,
        organizationId,
        "meetingsCreated",
      );

      expect(result).toBeNull();
    });

    it("should not update non-existent membership", async () => {
      const result = await incrementEngagementScore(
        userId,
        organizationId,
        "meetingsCreated",
      );

      expect(result).toBeNull();
    });

    it("should accept custom point values", async () => {
      await Membership.create({
        user: userId,
        organization: organizationId,
        role: "member",
        status: "active",
      });

      const result = await incrementEngagementScore(
        userId,
        organizationId,
        "meetingsCreated",
        25,
      );

      expect(result.engagementScore).toBe(25);
    });

    it("should handle all defined action types", async () => {
      await Membership.create({
        user: userId,
        organization: organizationId,
        role: "member",
        status: "active",
      });

      const actionTypes = [
        "meetingsCreated",
        "meetingsAttended",
        "decisionsContributed",
        "actionItemsResolved",
        "liveMeetingParticipation",
        "policiesUploaded",
      ];

      for (const actionType of actionTypes) {
        await incrementEngagementScore(userId, organizationId, actionType);
      }

      const membership = await Membership.findOne({
        user: userId,
        organization: organizationId,
      });

      expect(membership.engagementScore).toBe(10 + 5 + 8 + 12 + 6 + 15);
      expect(membership.engagementBreakdown.meetingsCreated).toBe(1);
      expect(membership.engagementBreakdown.meetingsAttended).toBe(1);
      expect(membership.engagementBreakdown.decisionsContributed).toBe(1);
      expect(membership.engagementBreakdown.actionItemsResolved).toBe(1);
      expect(membership.engagementBreakdown.liveMeetingParticipation).toBe(1);
      expect(membership.engagementBreakdown.policiesUploaded).toBe(1);
    });
  });

  describe("getLeaderboard", () => {
    it("should return members ranked by engagement score", async () => {
      const user1 = new mongoose.Types.ObjectId();
      const user2 = new mongoose.Types.ObjectId();
      const user3 = new mongoose.Types.ObjectId();

      await Membership.create({
        user: user1,
        organization: organizationId,
        role: "member",
        status: "active",
        engagementScore: 50,
      });
      await Membership.create({
        user: user2,
        organization: organizationId,
        role: "member",
        status: "active",
        engagementScore: 100,
      });
      await Membership.create({
        user: user3,
        organization: organizationId,
        role: "member",
        status: "active",
        engagementScore: 75,
      });

      const leaderboard = await getLeaderboard(organizationId);

      expect(leaderboard).toHaveLength(3);
      expect(leaderboard[0].rank).toBe(1);
      expect(leaderboard[0].engagementScore).toBe(100);
      expect(leaderboard[1].rank).toBe(2);
      expect(leaderboard[1].engagementScore).toBe(75);
      expect(leaderboard[2].rank).toBe(3);
      expect(leaderboard[2].engagementScore).toBe(50);
    });

    it("should only return members from the specified organization", async () => {
      const otherOrgId = new mongoose.Types.ObjectId();
      const user1 = new mongoose.Types.ObjectId();
      const user2 = new mongoose.Types.ObjectId();

      await Membership.create({
        user: user1,
        organization: organizationId,
        role: "member",
        status: "active",
        engagementScore: 50,
      });
      await Membership.create({
        user: user2,
        organization: otherOrgId,
        role: "member",
        status: "active",
        engagementScore: 100,
      });

      const leaderboard = await getLeaderboard(organizationId);

      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0].engagementScore).toBe(50);
    });

    it("should exclude members with zero engagement score", async () => {
      const user1 = new mongoose.Types.ObjectId();
      const user2 = new mongoose.Types.ObjectId();

      await Membership.create({
        user: user1,
        organization: organizationId,
        role: "member",
        status: "active",
        engagementScore: 50,
      });
      await Membership.create({
        user: user2,
        organization: organizationId,
        role: "member",
        status: "active",
        engagementScore: 0,
      });

      const leaderboard = await getLeaderboard(organizationId);

      expect(leaderboard).toHaveLength(1);
    });

    it("should respect the limit parameter", async () => {
      for (let i = 0; i < 5; i++) {
        await Membership.create({
          user: new mongoose.Types.ObjectId(),
          organization: organizationId,
          role: "member",
          status: "active",
          engagementScore: (i + 1) * 10,
        });
      }

      const leaderboard = await getLeaderboard(organizationId, 3);

      expect(leaderboard).toHaveLength(3);
    });

    it("should return empty array for organization with no activity", async () => {
      const leaderboard = await getLeaderboard(organizationId);

      expect(leaderboard).toHaveLength(0);
    });

    it("should handle ties consistently", async () => {
      const user1 = new mongoose.Types.ObjectId();
      const user2 = new mongoose.Types.ObjectId();

      await Membership.create({
        user: user1,
        organization: organizationId,
        role: "member",
        status: "active",
        engagementScore: 50,
      });
      await Membership.create({
        user: user2,
        organization: organizationId,
        role: "member",
        status: "active",
        engagementScore: 50,
      });

      const leaderboard = await getLeaderboard(organizationId);

      expect(leaderboard).toHaveLength(2);
      expect(leaderboard[0].engagementScore).toBe(50);
      expect(leaderboard[1].engagementScore).toBe(50);
    });

    it("should exclude suspended or removed members", async () => {
      const user1 = new mongoose.Types.ObjectId();
      const user2 = new mongoose.Types.ObjectId();

      await Membership.create({
        user: user1,
        organization: organizationId,
        role: "member",
        status: "active",
        engagementScore: 50,
      });
      await Membership.create({
        user: user2,
        organization: organizationId,
        role: "member",
        status: "suspended",
        engagementScore: 100,
      });

      const leaderboard = await getLeaderboard(organizationId);

      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0].engagementScore).toBe(50);
    });
  });

  describe("getMembershipEngagement", () => {
    it("should return engagement data for a member", async () => {
      await Membership.create({
        user: userId,
        organization: organizationId,
        role: "member",
        status: "active",
        engagementScore: 42,
        engagementBreakdown: {
          meetingsCreated: 3,
          meetingsAttended: 2,
          lastActivityAt: new Date(),
        },
      });

      const result = await getMembershipEngagement(userId, organizationId);

      expect(result).not.toBeNull();
      expect(result.engagementScore).toBe(42);
      expect(result.engagementBreakdown.meetingsCreated).toBe(3);
    });

    it("should return null for non-existent membership", async () => {
      const result = await getMembershipEngagement(userId, organizationId);

      expect(result).toBeNull();
    });

    it("should return null for suspended membership", async () => {
      await Membership.create({
        user: userId,
        organization: organizationId,
        role: "member",
        status: "suspended",
        engagementScore: 42,
      });

      const result = await getMembershipEngagement(userId, organizationId);

      expect(result).toBeNull();
    });
  });
});
