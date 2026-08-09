import request from "supertest";
import mongoose from "mongoose";
import { app } from "../server.js";
import { createClerkTestToken, authHeader } from "./helpers/clerkTestAuth.js";
import User from "../models/userModel.js";
import Organization from "../models/organizationModel.js";
import Membership from "../models/membershipModel.js";

describe("MembershipController - removeMembership", () => {
  let adminUser;
  let adminToken;
  let memberUser;
  let organization;
  let memberMembership;

  beforeEach(async () => {
    organization = await Organization.create({
      name: "Test Org",
      slug: "test-org-" + Math.random().toString(36).substring(7),
      owner: new mongoose.Types.ObjectId(),
    });

    adminUser = await User.create({
      name: "Admin User",
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

    organization.owner = adminUser._id;
    await organization.save();

    await Membership.create({
      user: adminUser._id,
      organization: organization._id,
      role: "admin",
      status: "active",
    });

    memberUser = await User.create({
      name: "Member User",
      email: `member-${Math.random()}@example.com`,
      password: "password123",
      organization: organization._id,
      role: "member",
      isAccountVerified: true,
    });
    memberUser.clerkUserId = `user_test_${memberUser._id}`;
    await memberUser.save();

    memberMembership = await Membership.create({
      user: memberUser._id,
      organization: organization._id,
      role: "member",
      status: "active",
    });

    await Membership.create({
      user: memberUser._id,
      organization: new mongoose.Types.ObjectId(),
      role: "member",
      status: "active",
    });
  });

  it("should clear organization and role on the removed user when admin removes a member", async () => {
    const res = await request(app)
      .delete(`/api/membership/${memberMembership._id}`)
      .set(authHeader(adminToken));

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);

    const updatedUser = await User.findById(memberUser._id);
    expect(updatedUser.organization).toBeNull();
    expect(updatedUser.role).toBeNull();
  });

  it("should not alter admin user's own organization/role when admin removes a member", async () => {
    await request(app)
      .delete(`/api/membership/${memberMembership._id}`)
      .set(authHeader(adminToken));

    const updatedAdmin = await User.findById(adminUser._id);
    expect(updatedAdmin.organization.toString()).toBe(
      organization._id.toString(),
    );
    expect(updatedAdmin.role).toBe("admin");
  });

  it("should not clear organization/role if the removed user's primary org differs", async () => {
    const otherOrg = await Organization.create({
      name: "Other Org",
      slug: "other-org-" + Math.random().toString(36).substring(7),
      owner: new mongoose.Types.ObjectId(),
    });

    memberUser.organization = otherOrg._id;
    memberUser.role = "member";
    await memberUser.save();

    const res = await request(app)
      .delete(`/api/membership/${memberMembership._id}`)
      .set(authHeader(adminToken));

    expect(res.statusCode).toEqual(200);

    const updatedUser = await User.findById(memberUser._id);
    expect(updatedUser.organization.toString()).toBe(otherOrg._id.toString());
    expect(updatedUser.role).toBe("member");
  });

  it("should return 403 if a regular member tries to remove another member", async () => {
    const otherMember = await User.create({
      name: "Other Member",
      email: `other-${Math.random()}@example.com`,
      password: "password123",
      organization: organization._id,
      role: "member",
      isAccountVerified: true,
    });
    otherMember.clerkUserId = `user_test_${otherMember._id}`;
    await otherMember.save();
    const otherToken = createClerkTestToken({
      clerkUserId: otherMember.clerkUserId,
      email: otherMember.email,
    });

    await Membership.create({
      user: otherMember._id,
      organization: organization._id,
      role: "member",
      status: "active",
    });

    const res = await request(app)
      .delete(`/api/membership/${memberMembership._id}`)
      .set(authHeader(otherToken));

    expect(res.statusCode).toEqual(403);
  });
});
