import userModel from "../models/userModel.js";
import crypto from "crypto";
import {
  isPlaceholderClerkEmail,
  mergePlaceholderAccount,
} from "./userAccountMergeService.js";

const DIAG = "[SYNC-CLERK-DIAG]";

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

/**
 * Provisions a new MongoDB user for a Clerk identity, or links an existing account matching by email.
 * Idempotent: multiple calls for the same Clerk user ID or email will return the same user without creating duplicates.
 * @param {Object} params
 * @param {string} params.clerkUserId - The Clerk user ID
 * @param {string} [params.email] - Primary email from Clerk identity
 * @param {string} [params.name] - User name from Clerk identity
 * @param {string} [params.profilePic] - Avatar image URL from Clerk identity
 * @returns {Promise<Object>} The MongoDB user document
 */
export const provisionOrLinkClerkUser = async ({
  clerkUserId,
  email,
  name,
  profilePic,
}) => {
  // TEMP DIAGNOSTIC — remove after root-cause confirmed in Render logs
  console.error(`${DIAG} provisionOrLinkClerkUser ENTER`, {
    clerkUserId: clerkUserId || null,
    email: email || null,
    name: name || null,
    hasProfilePic: Boolean(profilePic),
  });

  if (!clerkUserId) {
    throw new Error("clerkUserId is required for Clerk user provisioning");
  }

  // 1. Try finding existing user by clerkUserId
  console.error(`${DIAG} 6. Lookup by clerkUserId…`, { clerkUserId });
  let user = await userModel.findOne({ clerkUserId }).select("-password");
  console.error(`${DIAG} 6. clerkUserId lookup result`, {
    found: Boolean(user),
    mongoUserId: user?._id?.toString?.() || null,
    email: user?.email || null,
    isPlaceholderEmail: user ? isPlaceholderClerkEmail(user.email) : null,
    role: user?.role ?? null,
    organization: user?.organization?.toString?.() || null,
  });

  if (user) {
    let needsSave = false;
    const pending = {};
    if (profilePic && !user.profilePic) {
      user.profilePic = profilePic;
      needsSave = true;
      pending.profilePic = true;
    }
    if (name && (!user.name || user.name === "User")) {
      user.name = name;
      needsSave = true;
      pending.name = true;
    }
    // Session JWTs often omit email on first provision; fill/replace placeholders later.
    if (email && isPlaceholderClerkEmail(user.email)) {
      console.error(`${DIAG} Will replace placeholder email`, {
        from: user.email,
        to: email,
      });
      // Pre-check for unique-index collision (common 500 cause)
      const emailOwner = await userModel
        .findOne({ email })
        .select("_id clerkUserId email")
        .lean();
      console.error(
        `${DIAG} 7. Email occupancy check before placeholder patch`,
        {
          email,
          occupied: Boolean(emailOwner),
          occupiedById: emailOwner?._id?.toString?.() || null,
          occupiedByClerkId: emailOwner?.clerkUserId || null,
          sameDocument:
            emailOwner?._id?.toString?.() === user._id?.toString?.() || false,
        },
      );
      const occupiedByOther =
        emailOwner && emailOwner._id.toString() !== user._id.toString();
      if (occupiedByOther) {
        console.error(
          `${DIAG} 7. Email occupied by another account — merging placeholder (Issue #1114)`,
          {
            placeholderId: user._id?.toString?.() || null,
            verifiedId: emailOwner._id?.toString?.() || null,
            email,
          },
        );
        return await mergePlaceholderAccount({
          placeholder: user,
          verified: emailOwner,
          clerkUserId,
          email,
          name,
          profilePic,
        });
      }
      user.email = email;
      needsSave = true;
      pending.email = true;
    }
    if (needsSave) {
      console.error(
        `${DIAG} 10. DB write: user.save() (existing by clerkUserId)`,
        {
          pending,
          mongoUserId: user._id?.toString?.(),
          email: user.email,
        },
      );
      try {
        await user.save();
        console.error(`${DIAG} 10. user.save() OK`);
      } catch (err) {
        console.error(
          `${DIAG} 10. user.save() FAILED (existing by clerkUserId)`,
        );
        console.error(err);
        console.error(err?.stack);
        throw err;
      }
    } else {
      console.error(
        `${DIAG} No DB write needed (existing clerk user up to date)`,
      );
    }
    console.error(`${DIAG} 8. New Mongo user created: false`);
    return user;
  }

  // 2. Try finding existing user by email (Legacy migration case)
  if (email) {
    console.error(`${DIAG} 7. Lookup by email…`, { email });
    user = await userModel.findOne({ email }).select("-password");
    console.error(`${DIAG} 7. Email lookup result`, {
      found: Boolean(user),
      mongoUserId: user?._id?.toString?.() || null,
      existingClerkUserId: user?.clerkUserId || null,
    });
    if (user) {
      user.clerkUserId = clerkUserId;
      if (profilePic && !user.profilePic) {
        user.profilePic = profilePic;
      }
      if (name && (!user.name || user.name === "User")) {
        user.name = name;
      }
      console.error(
        `${DIAG} 10. DB write: user.save() (link legacy by email)`,
        {
          mongoUserId: user._id?.toString?.(),
          clerkUserId,
          email: user.email,
        },
      );
      try {
        await user.save();
        console.error(`${DIAG} 10. user.save() OK (legacy link)`);
      } catch (err) {
        console.error(`${DIAG} 10. user.save() FAILED (legacy link)`);
        console.error(err);
        console.error(err?.stack);
        throw err;
      }
      console.error(`${DIAG} 8. New Mongo user created: false (linked legacy)`);
      return user;
    }
  } else {
    console.error(`${DIAG} 7. Email lookup skipped (no email provided)`);
  }

  // 3. Create a new provisioned user if no existing user matches
  const dummyPassword = `CLERK_AUTH_${crypto.randomBytes(16).toString("hex")}`;
  const userName = name || (email ? email.split("@")[0] : "Clerk User");
  const createPayload = {
    clerkUserId,
    email: email || `${clerkUserId}@clerk.placeholder`,
    name: userName,
    password: dummyPassword,
    isAccountVerified: true,
    hasCompletedOnboarding: false,
    profilePic: profilePic || "",
    role: null,
    organization: null,
  };

  console.error(`${DIAG} 8. Creating new Mongo user`, {
    clerkUserId: createPayload.clerkUserId,
    email: createPayload.email,
    name: createPayload.name,
    role: createPayload.role,
    organization: createPayload.organization,
  });
  console.error(
    `${DIAG} 9. Organization bootstrap: NOT started (create leaves organization=null)`,
  );
  console.error(`${DIAG} 10. DB write: userModel.create()`);

  let newUser;
  try {
    newUser = await userModel.create(createPayload);
    console.error(`${DIAG} 10. userModel.create() OK`, {
      mongoUserId: newUser?._id?.toString?.(),
    });
  } catch (err) {
    const isDuplicateKey =
      err?.code === 11000 ||
      err?.name === "MongoServerError" ||
      (err?.message && err.message.includes("E11000"));

    if (isDuplicateKey) {
      console.warn(
        `${DIAG} 10. Concurrent user creation race detected (E11000). Retrying lookup by clerkUserId/email...`,
      );
      // Retry finding existing user created by parallel request
      const existingUser = await userModel
        .findOne({
          $or: [{ clerkUserId }, ...(email ? [{ email }] : [])],
        })
        .select("-password");

      if (existingUser) {
        console.warn(
          `${DIAG} 10. Concurrent provisioning race resolved cleanly. Reusing existing user ${existingUser._id}`,
        );
        const existingObj = existingUser.toObject
          ? existingUser.toObject()
          : existingUser;
        delete existingObj.password;
        return existingObj;
      }
    }

    console.error(`${DIAG} 10. userModel.create() FAILED`);
    console.error(err);
    console.error(err?.stack);
    console.error(`${DIAG} create failure meta`, {
      name: err?.name,
      message: err?.message,
      code: err?.code,
      keyPattern: err?.keyPattern,
      keyValue: err?.keyValue,
      errors: err?.errors
        ? Object.fromEntries(
            Object.entries(err.errors).map(([k, v]) => [
              k,
              {
                message: v?.message,
                kind: v?.kind,
                path: v?.path,
                value: v?.value,
              },
            ]),
          )
        : undefined,
    });
    throw err;
  }

  const createdObj = newUser.toObject();
  delete createdObj.password;
  console.error(`${DIAG} 8. New Mongo user created: true`);
  return createdObj;
};
