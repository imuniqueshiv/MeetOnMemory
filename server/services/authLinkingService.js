import userModel from "../models/userModel.js";

/**
 * Finds a MongoDB user by their Clerk ID.
 * @param {string} clerkUserId - The Clerk user ID
 * @returns {Promise<Object|null>} The user object or null
 */
export const findUserByClerkId = async (clerkUserId) => {
  if (!clerkUserId) return null;
  return await userModel.findOne({ clerkUserId }).select("-password");
};

/**
 * Links an existing MongoDB user to a Clerk ID.
 * @param {string} mongoUserId - The MongoDB user ID
 * @param {string} clerkUserId - The Clerk user ID
 * @returns {Promise<Object>} The updated user object
 */
export const linkUserToClerkId = async (mongoUserId, clerkUserId) => {
  if (!mongoUserId || !clerkUserId) {
    throw new Error("Missing required IDs for linking");
  }
  return await userModel
    .findByIdAndUpdate(mongoUserId, { $set: { clerkUserId } }, { new: true })
    .select("-password");
};

/**
 * Finds a user by their email address.
 * Helpful for initial linking if the user logs in via Clerk but already has a Mongo account.
 * @param {string} email - The user's email address
 * @returns {Promise<Object|null>}
 */
export const findUserByEmail = async (email) => {
  if (!email) return null;
  return await userModel.findOne({ email }).select("-password");
};
