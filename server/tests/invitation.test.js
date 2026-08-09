import request from "supertest";
import mongoose from "mongoose";
import { jest } from "@jest/globals";
import { app } from "../server.js";
import { createClerkTestToken, authHeader } from "./helpers/clerkTestAuth.js";
import User from "../models/userModel.js";
import Organization from "../models/organizationModel.js";
import Membership from "../models/membershipModel.js";
import Invitation from "../models/invitationModel.js";
import jwt from "jsonwebtoken";

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
    adminUser.clerkUserId = `user_test_${adminUser._id}`;
    await adminUser.save();
    adminToken = createClerkTestToken({
      clerkUserId: adminUser.clerkUserId,
      email: adminUser.email,
    });

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
    normalUser.clerkUserId = `user_test_${normalUser._id}`;
    await normalUser.save();
    normalToken = createClerkTestToken({
      clerkUserId: normalUser.clerkUserId,
      email: normalUser.email,
    });

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
    expiredInviteeUser.clerkUserId = `user_test_${expiredInviteeUser._id}`;
    await expiredInviteeUser.save();
    expiredInviteeToken = createClerkTestToken({
      clerkUserId: expiredInviteeUser.clerkUserId,
      email: expiredInviteeUser.email,
    });
    inviteUser.clerkUserId = `user_test_${inviteUser._id}`;
    await inviteUser.save();
    inviteToken = createClerkTestToken({
      clerkUserId: inviteUser.clerkUserId,
      email: inviteUser.email,
    });
  });

  describe("POST /api/invitation (Create Invitation)", () => {
    it("should allow admin to create an invitation", async () => {
      const res = await request(app)
        .post("/api/invitation")
        .set(authHeader(adminToken))
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
        .set(authHeader(adminToken))
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
        .set(authHeader(normalToken))
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
        .set(authHeader(adminToken));

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.invitations.length).toBe(1);
      expect(res.body.invitations[0].email).toBe(inviteUser.email);
    });

    it("should restrict listing invitations to admins only", async () => {
      const res = await request(app)
        .get(`/api/invitation/organization/${organization._id}`)
        .set(authHeader(normalToken));

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
        .set(authHeader(inviteToken));

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
        .set(authHeader(normalToken)); // normalUser has different email

      expect(res.statusCode).toEqual(403);
    });

    it("should reject accepting an expired invitation", async () => {
      const res = await request(app)
        .post(`/api/invitation/${expiredInvitation.token}/accept`)
        .set(authHeader(expiredInviteeToken));

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
        .set(authHeader(inviteToken));

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.invitation.status).toBe("declined");
    });

    it("should reject declining an expired invitation", async () => {
      const res = await request(app)
        .post(`/api/invitation/${expiredInvitation.token}/reject`)
        .set(authHeader(expiredInviteeToken));

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
        .set(authHeader(adminToken));

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
        .set(authHeader(adminToken));

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
        .set(authHeader(adminToken));

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
        email: expiredInviteeUser.email,
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

  describe("POST /api/invitations/bulk (Bulk Import)", () => {
    let organization;
    let adminUser;
    let adminToken;
    let normalUser;
    let normalToken;

    beforeEach(async () => {
      // Create organization
      organization = await Organization.create({
        name: "Bulk Test Org",
        slug: "bulk-test-org-" + Math.random().toString(36).substring(7),
        owner: new mongoose.Types.ObjectId(),
      });

      // Create admin user
      adminUser = await User.create({
        name: "Bulk Admin",
        email: `bulk-admin-${Math.random()}@example.com`,
        password: "password123",
        organization: organization._id,
        role: "admin",
        isAccountVerified: true,
      });
      adminUser.clerkUserId = `user_test_${adminUser._id}`;
      await adminUser.save();
      organization.owner = adminUser._id;
      await organization.save();
      adminToken = createClerkTestToken({
        clerkUserId: adminUser.clerkUserId,
        email: adminUser.email,
      });

      // Create normal user
      normalUser = await User.create({
        name: "Bulk Member",
        email: `bulk-member-${Math.random()}@example.com`,
        password: "password123",
        organization: organization._id,
        role: "member",
        isAccountVerified: true,
      });
      normalUser.clerkUserId = `user_test_${normalUser._id}`;
      await normalUser.save();
      normalToken = createClerkTestToken({
        clerkUserId: normalUser.clerkUserId,
        email: normalUser.email,
      });

      await Membership.create({
        user: normalUser._id,
        organization: organization._id,
        role: "member",
        status: "active",
      });
    });

    it("should successfully import valid CSV with multiple invitations", async () => {
      const csvContent =
        "email,role,message\n" +
        "user1@example.com,member,Welcome to the team\n" +
        "user2@example.com,admin,You're an admin\n" +
        "user3@example.com,member,Join us!";

      const res = await request(app)
        .post(`/api/invitations/bulk?organizationId=${organization._id}`)
        .set(authHeader(adminToken))
        .attach("file", Buffer.from(csvContent), "invitations.csv");

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results.total).toBe(3);
      expect(res.body.results.successful).toBe(3);
      expect(res.body.results.failed).toBe(0);
      expect(res.body.results.invitations).toHaveLength(3);

      // Verify invitations were created
      const invitations = await Invitation.find({
        organization: organization._id,
        status: "pending",
      });
      expect(invitations).toHaveLength(3);
    });

    it("should reject CSV with invalid email addresses", async () => {
      const csvContent =
        "email,role,message\n" +
        "invalid-email,member,Invalid email\n" +
        "user2@example.com,admin,Valid email";

      const res = await request(app)
        .post(`/api/invitations/bulk?organizationId=${organization._id}`)
        .set(authHeader(adminToken))
        .attach("file", Buffer.from(csvContent), "invitations.csv");

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results.total).toBe(2);
      expect(res.body.results.successful).toBe(1);
      expect(res.body.results.failed).toBe(1);
      expect(res.body.results.errors).toHaveLength(1);
      expect(res.body.results.errors[0].error).toContain("Invalid email");
    });

    it("should reject CSV with invalid roles", async () => {
      const csvContent =
        "email,role,message\n" +
        "user1@example.com,invalid_role,Invalid role\n" +
        "user2@example.com,admin,Valid role";

      const res = await request(app)
        .post(`/api/invitations/bulk?organizationId=${organization._id}`)
        .set(authHeader(adminToken))
        .attach("file", Buffer.from(csvContent), "invitations.csv");

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results.total).toBe(2);
      expect(res.body.results.successful).toBe(1);
      expect(res.body.results.failed).toBe(1);
      expect(res.body.results.errors[0].error).toContain("Invalid role");
    });

    it("should reject CSV with more than 100 rows", async () => {
      let csvContent = "email,role,message\n";
      for (let i = 1; i <= 101; i++) {
        csvContent += `user${i}@example.com,member,Message ${i}\n`;
      }

      const res = await request(app)
        .post(`/api/invitations/bulk?organizationId=${organization._id}`)
        .set(authHeader(adminToken))
        .attach("file", Buffer.from(csvContent), "invitations.csv");

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Maximum 100 invitations");
    });

    it("should reject empty CSV file", async () => {
      const csvContent = "email,role,message\n";

      const res = await request(app)
        .post(`/api/invitations/bulk?organizationId=${organization._id}`)
        .set(authHeader(adminToken))
        .attach("file", Buffer.from(csvContent), "invitations.csv");

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("CSV file is empty");
    });

    it("should reject malformed CSV (missing email column)", async () => {
      const csvContent = "role,message\n" + "admin,Test\n";

      const res = await request(app)
        .post(`/api/invitations/bulk?organizationId=${organization._id}`)
        .set(authHeader(adminToken))
        .attach("file", Buffer.from(csvContent), "invitations.csv");

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results.total).toBe(1);
      expect(res.body.results.failed).toBe(1);
      expect(res.body.results.errors[0].error).toContain("Email is required");
    });

    it("should handle mixed successful and failed rows", async () => {
      const csvContent =
        "email,role,message\n" +
        "user1@example.com,member,Valid\n" +
        "invalid-email,member,Invalid email\n" +
        "user2@example.com,invalid_role,Invalid role\n" +
        "user3@example.com,admin,Valid";

      const res = await request(app)
        .post(`/api/invitations/bulk?organizationId=${organization._id}`)
        .set(authHeader(adminToken))
        .attach("file", Buffer.from(csvContent), "invitations.csv");

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results.total).toBe(4);
      expect(res.body.results.successful).toBe(2);
      expect(res.body.results.failed).toBe(2);
      expect(res.body.results.errors).toHaveLength(2);
    });

    it("should reject invitations for existing members", async () => {
      // Create an existing member
      const existingUser = await User.create({
        name: "Existing Member",
        email: "existing@example.com",
        password: "password123",
        isAccountVerified: true,
      });
      existingUser.clerkUserId = `user_test_${existingUser._id}`;
      await existingUser.save();

      await Membership.create({
        user: existingUser._id,
        organization: organization._id,
        role: "member",
        status: "active",
      });

      const csvContent =
        "email,role,message\n" +
        "existing@example.com,member,Already a member\n" +
        "new@example.com,member,New user";

      const res = await request(app)
        .post(`/api/invitations/bulk?organizationId=${organization._id}`)
        .set(authHeader(adminToken))
        .attach("file", Buffer.from(csvContent), "invitations.csv");

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results.total).toBe(2);
      expect(res.body.results.successful).toBe(1);
      expect(res.body.results.failed).toBe(1);
      expect(res.body.results.errors[0].error).toContain(
        "already a member of this organization",
      );
    });

    it("should reject duplicate pending invitations", async () => {
      // Create an existing pending invitation
      await Invitation.create({
        organization: organization._id,
        email: "pending@example.com",
        invitedBy: adminUser._id,
        token: "existing_token",
        role: "member",
        status: "pending",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      const csvContent =
        "email,role,message\n" +
        "pending@example.com,member,Duplicate pending\n" +
        "new@example.com,member,New user";

      const res = await request(app)
        .post(`/api/invitations/bulk?organizationId=${organization._id}`)
        .set(authHeader(adminToken))
        .attach("file", Buffer.from(csvContent), "invitations.csv");

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results.total).toBe(2);
      expect(res.body.results.successful).toBe(1);
      expect(res.body.results.failed).toBe(1);
      expect(res.body.results.errors[0].error).toContain(
        "Pending invitation already exists",
      );
    });

    it("should require authentication", async () => {
      const csvContent =
        "email,role,message\n" + "user1@example.com,member,Test";

      const res = await request(app)
        .post(`/api/invitations/bulk?organizationId=${organization._id}`)
        .attach("file", Buffer.from(csvContent), "invitations.csv");

      expect(res.statusCode).toEqual(401);
      expect(res.body.success).toBe(false);
    });

    it("should require admin authorization", async () => {
      const csvContent =
        "email,role,message\n" + "user1@example.com,member,Test";

      const res = await request(app)
        .post(`/api/invitations/bulk?organizationId=${organization._id}`)
        .set(authHeader(normalToken))
        .attach("file", Buffer.from(csvContent), "invitations.csv");

      expect(res.statusCode).toEqual(403);
      expect(res.body.success).toBe(false);
    });

    it("should reject non-CSV files", async () => {
      const res = await request(app)
        .post(`/api/invitations/bulk?organizationId=${organization._id}`)
        .set(authHeader(adminToken))
        .attach("file", Buffer.from("not a csv"), "test.txt");

      expect(res.statusCode).toEqual(500);
      expect(res.body.success).toBe(false);
    });

    it("should require organizationId", async () => {
      const csvContent =
        "email,role,message\n" + "user1@example.com,member,Test";

      const res = await request(app)
        .post("/api/invitations/bulk")
        .set(authHeader(adminToken))
        .attach("file", Buffer.from(csvContent), "invitations.csv");

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Organization ID is required");
    });

    it("should handle CSV with optional message column", async () => {
      const csvContent =
        "email,role\n" +
        "user1@example.com,member\n" +
        "user2@example.com,admin";

      const res = await request(app)
        .post(`/api/invitations/bulk?organizationId=${organization._id}`)
        .set(authHeader(adminToken))
        .attach("file", Buffer.from(csvContent), "invitations.csv");

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results.successful).toBe(2);
    });

    it("should handle CSV with default role when not specified", async () => {
      const csvContent =
        "email\n" + "user1@example.com\n" + "user2@example.com";

      const res = await request(app)
        .post(`/api/invitations/bulk?organizationId=${organization._id}`)
        .set(authHeader(adminToken))
        .attach("file", Buffer.from(csvContent), "invitations.csv");

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results.successful).toBe(2);

      // Verify default role is member
      const invitations = await Invitation.find({
        organization: organization._id,
        status: "pending",
      });
      expect(invitations.every((inv) => inv.role === "member")).toBe(true);
    });
  });
});
