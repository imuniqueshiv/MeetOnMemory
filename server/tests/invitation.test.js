import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { jest } from "@jest/globals";
import { app } from "../server.js";
import User from "../models/userModel.js";
import Organization from "../models/organizationModel.js";
import Membership from "../models/membershipModel.js";
import Invitation from "../models/invitationModel.js";

// Mock nodemailer to prevent SMTP verification during tests
jest.mock("../config/nodeMailer.js", () => ({
  sendMail: jest.fn(),
  __esModule: true,
  default: { sendMail: jest.fn() },
}));

describe("Organization Invitations & Member Onboarding", () => {
  let adminUser;
  let adminToken;
  let normalUser;
  let normalToken;
  let organization;
  let inviteUser;
  let inviteToken;
  let expiredInviteeUser;
  let expiredInviteeToken;

  beforeEach(async () => {
    // 1. Create Organization
    organization = await Organization.create({
      name: "Acme Corp",
      slug: "acme-corp-" + Math.random().toString(36).substring(7),
      owner: new mongoose.Types.ObjectId(), // Will set to adminUser._id below
    });

    // 2. Create Admin User (Owner)
    adminUser = await User.create({
      name: "Admin Owner",
      email: `admin-${Math.random()}@example.com`,
      password: "password123",
      organization: organization._id,
      role: "admin",
      isAccountVerified: true,
    });
    adminToken = jwt.sign(
      { id: adminUser._id },
      process.env.JWT_SECRET || "fallback_secret",
    );

    // Update organization owner link
    organization.owner = adminUser._id;
    await organization.save();

    // Create Admin Membership
    await Membership.create({
      user: adminUser._id,
      organization: organization._id,
      role: "admin",
      status: "active",
    });

    // 3. Create normal user (already member)
    normalUser = await User.create({
      name: "Normal Member",
      email: `member-${Math.random()}@example.com`,
      password: "password123",
      organization: organization._id,
      role: "member",
      isAccountVerified: true,
    });
    normalToken = jwt.sign(
      { id: normalUser._id },
      process.env.JWT_SECRET || "fallback_secret",
    );

    await Membership.create({
      user: normalUser._id,
      organization: organization._id,
      role: "member",
      status: "active",
    });

    // 4. Create user to invite (not part of org yet)
    inviteUser = await User.create({
      name: "Invitee",
      email: `invitee-${Math.random()}@example.com`,
      password: "password123",
      isAccountVerified: true,
    });
    inviteToken = jwt.sign(
      { id: inviteUser._id },
      process.env.JWT_SECRET || "fallback_secret",
    );

    // 5. Create expired invitee user for expiry tests
    expiredInviteeUser = await User.create({
      name: "Expired Invitee",
      email: "expired_invitee@example.com",
      password: "password123",
      isAccountVerified: true,
    });
    expiredInviteeToken = jwt.sign(
      { id: expiredInviteeUser._id },
      process.env.JWT_SECRET || "fallback_secret",
    );
  });

  describe("POST /api/invitation (Create Invitation)", () => {
    it("should allow admin to create an invitation", async () => {
      const res = await request(app)
        .post("/api/invitation")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          organizationId: organization._id,
          email: inviteUser.email,
          role: "member",
          message: "Welcome to Acme Corp!",
          expiresIn: 7,
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.invitation.email).toBe(inviteUser.email);
      expect(res.body.invitation.status).toBe("pending");
      expect(res.body.invitation.role).toBe("member");
    });

    it("should reject invitation if email is already active member", async () => {
      const res = await request(app)
        .post("/api/invitation")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          organizationId: organization._id,
          email: normalUser.email,
          role: "member",
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("already a member");
    });

    it("should prevent normal member from creating invitations", async () => {
      const res = await request(app)
        .post("/api/invitation")
        .set("Authorization", `Bearer ${normalToken}`)
        .send({
          organizationId: organization._id,
          email: inviteUser.email,
          role: "member",
        });

      expect(res.statusCode).toEqual(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/invitation/organization/:organizationId", () => {
    beforeEach(async () => {
      await Invitation.create({
        organization: organization._id,
        email: inviteUser.email,
        invitedBy: adminUser._id,
        token: "test_token_123",
        role: "member",
        status: "pending",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    });

    it("should allow admin to list pending organization invitations", async () => {
      const res = await request(app)
        .get(`/api/invitation/organization/${organization._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.invitations.length).toBe(1);
      expect(res.body.invitations[0].email).toBe(inviteUser.email);
    });

    it("should restrict listing invitations to admins only", async () => {
      const res = await request(app)
        .get(`/api/invitation/organization/${organization._id}`)
        .set("Authorization", `Bearer ${normalToken}`);

      expect(res.statusCode).toEqual(403);
    });
  });

  describe("POST /api/invitation/:token/accept (Accept invitation)", () => {
    let invitation;
    let expiredInvitation;

    beforeEach(async () => {
      invitation = await Invitation.create({
        organization: organization._id,
        email: inviteUser.email,
        invitedBy: adminUser._id,
        token: "accept_token_abc",
        role: "member",
        status: "pending",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      expiredInvitation = await Invitation.create({
        organization: organization._id,
        email: expiredInviteeUser.email,
        invitedBy: adminUser._id,
        token: "expired_accept_token_xyz",
        role: "member",
        status: "pending",
        expiresAt: new Date(Date.now() - 1000), // expired
      });
    });

    it("should allow invitee to accept invitation and join organization", async () => {
      const res = await request(app)
        .post(`/api/invitation/${invitation.token}/accept`)
        .set("Authorization", `Bearer ${inviteToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.invitation.status).toBe("accepted");

      // Verify membership record is created
      const m = await Membership.findOne({
        user: inviteUser._id,
        organization: organization._id,
        status: "active",
      });
      expect(m).not.toBeNull();
      expect(m.role).toBe("member");

      // Verify user model is updated
      const updatedUser = await User.findById(inviteUser._id);
      expect(updatedUser.organization.toString()).toBe(
        organization._id.toString(),
      );
    });

    it("should reject accept requests from other users", async () => {
      const res = await request(app)
        .post(`/api/invitation/${invitation.token}/accept`)
        .set("Authorization", `Bearer ${normalToken}`); // normalUser has different email

      expect(res.statusCode).toEqual(403);
    });

    it("should reject accepting an expired invitation", async () => {
      const res = await request(app)
        .post(`/api/invitation/${expiredInvitation.token}/accept`)
        .set("Authorization", `Bearer ${expiredInviteeToken}`);

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invitation has expired.");

      // Verify the invitation status was updated to expired
      const updatedInvitation = await Invitation.findById(
        expiredInvitation._id,
      );
      expect(updatedInvitation.status).toBe("expired");

      // Verify no membership was created
      const m = await Membership.findOne({
        user: expiredInviteeUser._id,
        organization: organization._id,
        status: "active",
      });
      expect(m).toBeNull();
    });
  });

  describe("POST /api/invitation/:token/reject (Decline invitation)", () => {
    let invitation;
    let expiredInvitation;

    beforeEach(async () => {
      invitation = await Invitation.create({
        organization: organization._id,
        email: inviteUser.email,
        invitedBy: adminUser._id,
        token: "reject_token_def",
        role: "member",
        status: "pending",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      expiredInvitation = await Invitation.create({
        organization: organization._id,
        email: expiredInviteeUser.email,
        invitedBy: adminUser._id,
        token: "expired_reject_token_xyz",
        role: "member",
        status: "pending",
        expiresAt: new Date(Date.now() - 1000), // expired
      });
    });

    it("should allow invitee to decline invitation", async () => {
      const res = await request(app)
        .post(`/api/invitation/${invitation.token}/reject`)
        .set("Authorization", `Bearer ${inviteToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.invitation.status).toBe("declined");
    });

    it("should reject declining an expired invitation", async () => {
      const res = await request(app)
        .post(`/api/invitation/${expiredInvitation.token}/reject`)
        .set("Authorization", `Bearer ${expiredInviteeToken}`);

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invitation has expired.");

      // Verify the invitation status was updated to expired
      const updatedInvitation = await Invitation.findById(
        expiredInvitation._id,
      );
      expect(updatedInvitation.status).toBe("expired");
    });
  });

  describe("DELETE /api/invitation/:id (Cancel invitation)", () => {
    let invitation;

    beforeEach(async () => {
      invitation = await Invitation.create({
        organization: organization._id,
        email: inviteUser.email,
        invitedBy: adminUser._id,
        token: "cancel_token_ghi",
        role: "member",
        status: "pending",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    });

    it("should allow admin to cancel invitation", async () => {
      const res = await request(app)
        .delete(`/api/invitation/${invitation._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.invitation.status).toBe("cancelled");
    });
  });

  describe("POST /api/invitation/:id/resend (Resend invitation)", () => {
    let invitation;

    beforeEach(async () => {
      invitation = await Invitation.create({
        organization: organization._id,
        email: inviteUser.email,
        invitedBy: adminUser._id,
        token: "resend_token_jkl",
        role: "member",
        status: "pending",
        expiresAt: new Date(Date.now() - 1000), // expired already
      });
    });

    it("should allow admin to resend invitation and update token/expiry", async () => {
      const res = await request(app)
        .post(`/api/invitation/${invitation._id}/resend`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.invitation.status).toBe("pending");
      expect(res.body.invitation.token).not.toBe("resend_token_jkl");
      expect(new Date(res.body.invitation.expiresAt) > new Date()).toBe(true);
    });
  });

  describe("POST /api/invitation/:id/expire (Manually expire invitation)", () => {
    let invitation;

    beforeEach(async () => {
      invitation = await Invitation.create({
        organization: organization._id,
        email: inviteUser.email,
        invitedBy: adminUser._id,
        token: "expire_token_mno",
        role: "member",
        status: "pending",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    });

    it("should allow admin to manually expire invitation", async () => {
      const res = await request(app)
        .post(`/api/invitation/${invitation._id}/expire`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.invitation.status).toBe("expired");
    });
  });

  describe("GET /api/invitation/:token (Get invitation by token)", () => {
    let validInvitation;
    let expiredInvitation;
    let boundaryInvitation;

    beforeEach(async () => {
      // Create a valid invitation
      validInvitation = await Invitation.create({
        organization: organization._id,
        email: inviteUser.email,
        invitedBy: adminUser._id,
        token: "valid_token_abc",
        role: "member",
        status: "pending",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // expires in 24 hours
      });

      // Create an expired invitation
      expiredInvitation = await Invitation.create({
        organization: organization._id,
        email: `expired-${Math.random()}@example.com`,
        invitedBy: adminUser._id,
        token: "expired_token_def",
        role: "member",
        status: "pending",
        expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
      });

      // Create a boundary case invitation (just expired)
      boundaryInvitation = await Invitation.create({
        organization: organization._id,
        email: `boundary-${Math.random()}@example.com`,
        invitedBy: adminUser._id,
        token: "boundary_token_ghi",
        role: "member",
        status: "pending",
        expiresAt: new Date(Date.now() - 1), // just expired (1ms ago)
      });
    });

    it("should return invitation details for valid, non-expired invitation", async () => {
      const res = await request(app).get(
        `/api/invitation/${validInvitation.token}`,
      );

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.invitation.token).toBe(validInvitation.token);
      expect(res.body.invitation.email).toBe(inviteUser.email);
      expect(res.body.invitation.status).toBe("pending");
      expect(res.body.invitation.organization).toBeDefined();
    });

    it("should return 400 for expired invitation", async () => {
      const res = await request(app).get(
        `/api/invitation/${expiredInvitation.token}`,
      );

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invitation has expired.");

      // Verify the invitation status was updated to expired
      const updatedInvitation = await Invitation.findById(
        expiredInvitation._id,
      );
      expect(updatedInvitation.status).toBe("expired");
    });

    it("should return 400 for boundary case (just expired) invitation", async () => {
      const res = await request(app).get(
        `/api/invitation/${boundaryInvitation.token}`,
      );

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invitation has expired.");

      // Verify the invitation status was updated to expired
      const updatedInvitation = await Invitation.findById(
        boundaryInvitation._id,
      );
      expect(updatedInvitation.status).toBe("expired");
    });

    it("should return 404 for non-existent invitation token", async () => {
      const res = await request(app).get("/api/invitation/nonexistent_token");

      expect(res.statusCode).toEqual(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invitation not found.");
    });

    it("should return 400 for invitation with non-pending status", async () => {
      // Create an accepted invitation
      const acceptedInvitation = await Invitation.create({
        organization: organization._id,
        email: `accepted-${Math.random()}@example.com`,
        invitedBy: adminUser._id,
        token: "accepted_token_jkl",
        role: "member",
        status: "accepted",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const res = await request(app).get(
        `/api/invitation/${acceptedInvitation.token}`,
      );

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invitation is not in pending status.");
    });
  });
});
