import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { provisionOrLinkClerkUser } from "../services/authLinkingService.js";
import { AccountMergeError } from "../services/userAccountMergeService.js";
import User from "../models/userModel.js";
import Meeting from "../models/meetingModel.js";
import Notification from "../models/notificationModel.js";
import Bookmark from "../models/bookmarkModel.js";
import Organization from "../models/organizationModel.js";

/**
 * Regression for Issue #1114:
 * When a Clerk placeholder account (placeholder email) is synced with a real
 * email that is already owned by a verified account, the two must merge instead
 * of failing on the unique email index.
 */
describe("Clerk placeholder email merge (#1114)", () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      Meeting.deleteMany({}),
      Notification.deleteMany({}),
      Bookmark.deleteMany({}),
      Organization.deleteMany({}),
    ]);
  });

  const createPlaceholderUser = (clerkUserId, extra = {}) =>
    User.create({
      name: "Placeholder User",
      email: `${clerkUserId}@clerk.placeholder`,
      password: "CLERK_AUTH_placeholder",
      isAccountVerified: true,
      hasCompletedOnboarding: false,
      role: null,
      organization: null,
      clerkUserId,
      ...extra,
    });

  const createVerifiedUser = (email, clerkUserId = null) =>
    User.create({
      name: "Verified User",
      email,
      password: "legacy-password",
      isAccountVerified: true,
      clerkUserId,
    });

  const createMeeting = (uploadedBy) =>
    Meeting.create({
      uploadedBy,
      title: "Quarterly planning",
      date: new Date(),
    });

  it("fills in a real email on the placeholder when the address is not taken", async () => {
    const placeholder = await createPlaceholderUser("user_alpha");

    const result = await provisionOrLinkClerkUser({
      clerkUserId: "user_alpha",
      email: "real@example.com",
      name: "Alpha User",
    });

    expect(result._id.toString()).toBe(placeholder._id.toString());
    expect(result.email).toBe("real@example.com");
    expect(await User.countDocuments({})).toBe(1);

    const stored = await User.findById(placeholder._id);
    expect(stored.email).toBe("real@example.com");
  });

  it("merges the placeholder into the verified email owner and preserves data", async () => {
    const placeholder = await createPlaceholderUser("user_alpha");
    const verified = await createVerifiedUser("real@example.com");

    const meeting = await createMeeting(placeholder._id);
    await Notification.create({
      user: placeholder._id,
      title: "Reminder",
      description: "Test reminder",
    });
    const sharedMeeting = await createMeeting(placeholder._id);
    await Bookmark.create({
      user: placeholder._id,
      meeting: sharedMeeting._id,
    });
    await Bookmark.create({
      user: verified._id,
      meeting: sharedMeeting._id,
    });

    const result = await provisionOrLinkClerkUser({
      clerkUserId: "user_alpha",
      email: "real@example.com",
      name: "Alpha User",
      profilePic: "https://example.com/avatar.png",
    });

    // The verified account survives, claims the Clerk identity, and keeps its
    // own display data.
    expect(result._id.toString()).toBe(verified._id.toString());
    expect(result.clerkUserId).toBe("user_alpha");
    expect(result.email).toBe("real@example.com");
    expect(result.name).toBe("Verified User");
    expect(result.password).toBeUndefined();

    // The placeholder row is gone.
    expect(await User.findById(placeholder._id)).toBeNull();
    expect(await User.countDocuments({})).toBe(1);

    // Owned documents were reassigned.
    const storedMeeting = await Meeting.findById(meeting._id);
    expect(storedMeeting.uploadedBy.toString()).toBe(verified._id.toString());
    const storedNotification = await Notification.findOne({});
    expect(storedNotification.user.toString()).toBe(verified._id.toString());

    // Unique-indexed duplicates were dropped, not re-created.
    const bookmarks = await Bookmark.find({}).sort({ user: 1 });
    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0].user.toString()).toBe(verified._id.toString());
  });

  it("preserves onboarding progress when only the placeholder completed it", async () => {
    const org = await Organization.create({
      name: "Placeholder Org",
      slug: `placeholder-org-${Date.now()}`,
      owner: new mongoose.Types.ObjectId(),
    });
    const _placeholder = await createPlaceholderUser("user_alpha", {
      hasCompletedOnboarding: true,
      role: "member",
      organization: org._id,
    });
    const verified = await createVerifiedUser("real@example.com");

    const result = await provisionOrLinkClerkUser({
      clerkUserId: "user_alpha",
      email: "real@example.com",
    });

    expect(result._id.toString()).toBe(verified._id.toString());
    expect(result.organization.toString()).toBe(org._id.toString());
    expect(result.role).toBe("member");
    expect(result.hasCompletedOnboarding).toBe(true);
  });

  it("keeps the verified account's own organization when it already has one", async () => {
    const placeholderOrg = await Organization.create({
      name: "Placeholder Org",
      slug: `placeholder-org-${Date.now()}`,
      owner: new mongoose.Types.ObjectId(),
    });
    const verifiedOrg = await Organization.create({
      name: "Verified Org",
      slug: `verified-org-${Date.now()}`,
      owner: new mongoose.Types.ObjectId(),
    });
    const _placeholder = await createPlaceholderUser("user_alpha", {
      hasCompletedOnboarding: true,
      role: "member",
      organization: placeholderOrg._id,
    });
    const verified = await createVerifiedUser("real@example.com");
    verified.organization = verifiedOrg._id;
    verified.role = "owner";
    await verified.save();

    const result = await provisionOrLinkClerkUser({
      clerkUserId: "user_alpha",
      email: "real@example.com",
    });

    expect(result._id.toString()).toBe(verified._id.toString());
    expect(result.organization.toString()).toBe(verifiedOrg._id.toString());
    expect(result.role).toBe("owner");
  });

  it("rejects the merge when the email owner is linked to another Clerk identity", async () => {
    const placeholder = await createPlaceholderUser("user_alpha");
    await createVerifiedUser("real@example.com", "user_beta");

    await expect(
      provisionOrLinkClerkUser({
        clerkUserId: "user_alpha",
        email: "real@example.com",
      }),
    ).rejects.toThrow(AccountMergeError);

    await expect(
      provisionOrLinkClerkUser({
        clerkUserId: "user_alpha",
        email: "real@example.com",
      }),
    ).rejects.toThrow("different Clerk-linked account");

    // Nothing was deleted and no duplicate email was created.
    expect(await User.findById(placeholder._id)).not.toBeNull();
    expect(await User.countDocuments({})).toBe(2);
  });

  it("rejects the merge when the email owner is itself a placeholder", async () => {
    const placeholder = await createPlaceholderUser("user_alpha");
    const otherPlaceholder = await createPlaceholderUser("user_beta");

    await expect(
      provisionOrLinkClerkUser({
        clerkUserId: "user_alpha",
        email: "user_beta@clerk.placeholder",
      }),
    ).rejects.toThrow(AccountMergeError);

    expect(await User.findById(placeholder._id)).not.toBeNull();
    expect(await User.findById(otherPlaceholder._id)).not.toBeNull();
  });

  it("links a legacy account by email when no clerk identity exists yet", async () => {
    const verified = await createVerifiedUser("real@example.com");

    const result = await provisionOrLinkClerkUser({
      clerkUserId: "user_gamma",
      email: "real@example.com",
      name: "Legacy User",
    });

    expect(result._id.toString()).toBe(verified._id.toString());
    expect(result.clerkUserId).toBe("user_gamma");
    expect(await User.countDocuments({})).toBe(1);
  });

  it("provisions a placeholder account when the JWT carries no verified email", async () => {
    const result = await provisionOrLinkClerkUser({
      clerkUserId: "user_delta",
    });

    expect(result.clerkUserId).toBe("user_delta");
    expect(result.email).toBe("user_delta@clerk.placeholder");
    expect(result.password).toBeUndefined();
    expect(await User.countDocuments({})).toBe(1);
  });
});
