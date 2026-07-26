import request from "supertest"; // eslint-disable-line no-unused-vars
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { app } from "../server.js"; // eslint-disable-line no-unused-vars
import { createCsrfAgent } from "./helpers/csrfHelper.js";
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
    adminToken = jwt.sign(
      { id: adminUser._id },
      process.env.JWT_SECRET || "fallback_secret",
    );

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
    const { agent, csrfToken } = await createCsrfAgent();
    const res = await agent
      .delete(`/api/membership/${memberMembership._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-CSRF-Token", csrfToken);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);

    const updatedUser = await User.findById(memberUser._id);
    expect(updatedUser.organization).toBeNull();
    expect(updatedUser.role).toBeNull();
  });

  it("should not alter admin user's own organization/role when admin removes a member", async () => {
    const { agent, csrfToken } = await createCsrfAgent();
    await agent
      .delete(`/api/membership/${memberMembership._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-CSRF-Token", csrfToken);

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

    const { agent, csrfToken } = await createCsrfAgent();
    const res = await agent
      .delete(`/api/membership/${memberMembership._id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-CSRF-Token", csrfToken);

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
    const otherToken = jwt.sign(
      { id: otherMember._id },
      process.env.JWT_SECRET || "fallback_secret",
    );

    await Membership.create({
      user: otherMember._id,
      organization: organization._id,
      role: "member",
      status: "active",
    });

    const { agent, csrfToken } = await createCsrfAgent();
    const res = await agent
      .delete(`/api/membership/${memberMembership._id}`)
      .set("Authorization", `Bearer ${otherToken}`)
      .set("X-CSRF-Token", csrfToken);

    expect(res.statusCode).toEqual(403);
  });
});
