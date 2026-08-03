// server/controllers/digestPreferenceController.js

import mongoose from "mongoose";
import DigestPreference from "../models/digestPreferenceModel.js";
import User from "../models/userModel.js";
import Tag from "../models/tagModel.js";
import transporter from "../config/nodeMailer.js";
import MeetingDigestService from "../services/MeetingDigestService.js";

/**
 * @desc Get user digest preferences
 * @route GET /api/digest-preferences
 * @access Private
 */
export const getPreferences = async (req, res) => {
  try {
    const userId = req.user._id;
    const preferences = await DigestPreference.findOne({
      $or: [{ user: userId }, { userId }],
    });

    if (!preferences) {
      return res.status(200).json({
        success: true,
        data: {
          frequency: "weekly",
          includeSections: ["decisions", "action-items"],
          enabled: true,
          filterByTags: [],
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    console.error("Error fetching digest preferences:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch digest preferences.",
    });
  }
};

/**
 * @desc Update user digest preferences
 * @route PUT /api/digest-preferences
 * @access Private
 */
export const updatePreferences = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      frequency,
      includeSections,
      enabled,
      filterByTags,
      deliveryDay,
      deliveryHour,
      maxItems,
    } = req.body;

    const userOrgId = req.user.organization;

    let validTagIds = [];
    if (
      filterByTags &&
      Array.isArray(filterByTags) &&
      filterByTags.length > 0
    ) {
      if (!userOrgId) {
        return res.status(400).json({
          success: false,
          message: "User must belong to an organization to filter by tags.",
        });
      }

      // Check format of tag IDs
      for (const tagId of filterByTags) {
        if (!mongoose.Types.ObjectId.isValid(tagId)) {
          return res.status(400).json({
            success: false,
            message: `Invalid tag ID format: ${tagId}`,
          });
        }
      }

      // Find organization-owned tags matching all passed IDs
      const foundTags = await Tag.find({
        _id: { $in: filterByTags },
        organization: userOrgId,
      }).select("_id");

      if (foundTags.length !== filterByTags.length) {
        return res.status(400).json({
          success: false,
          message:
            "One or more tag IDs are invalid or do not belong to your organization.",
        });
      }

      validTagIds = foundTags.map((t) => t._id);
    }

    const updateFields = {
      user: userId,
      ...(frequency !== undefined && { frequency }),
      ...(includeSections !== undefined && { includeSections }),
      ...(enabled !== undefined && { enabled }),
      ...(deliveryDay !== undefined && { deliveryDay }),
      ...(deliveryHour !== undefined && { deliveryHour }),
      ...(maxItems !== undefined && { maxItems }),
      ...(filterByTags !== undefined && { filterByTags: validTagIds }),
    };

    const preferences = await DigestPreference.findOneAndUpdate(
      { $or: [{ user: userId }, { userId }] },
      updateFields,
      { new: true, upsert: true, runValidators: true },
    );

    return res.status(200).json({
      success: true,
      message: "Digest preferences updated successfully.",
      data: preferences,
    });
  } catch (error) {
    console.error("Error updating digest preferences:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update digest preferences.",
    });
  }
};

/**
 * @desc Preview digest content without sending
 * @route POST /api/digest-preferences/preview
 * @access Private
 */
export const previewDigest = async (req, res) => {
  try {
    const preferences = req.body;
    const sections = preferences.includeSections || [];

    let html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
        <div style="background-color: #4f46e5; color: white; padding: 24px; text-align: center;">
          <h2 style="margin: 0; font-size: 24px;">Your ${(preferences.frequency || "weekly").charAt(0).toUpperCase() + (preferences.frequency || "weekly").slice(1)} Digest</h2>
          <p style="margin: 8px 0 0 0; opacity: 0.9;">MeetOnMemory Summary</p>
        </div>
        <div style="padding: 24px; background-color: #fff; color: #1f2937;">
          <p style="font-size: 16px; margin-bottom: 24px;">Hello! Here's a customized snapshot of your recent meetings and tasks.</p>
    `;

    if (sections.includes("summaries")) {
      html += `
        <div style="margin-bottom: 24px;">
          <h3 style="color: #111827; border-bottom: 2px solid #f3f4f6; padding-bottom: 8px; margin-bottom: 16px; font-size: 18px;">Recent Summaries</h3>
          <ul style="list-style-type: none; padding-left: 0; margin: 0;">
            <li style="margin-bottom: 12px; padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
              <strong style="color: #4f46e5; display: block; margin-bottom: 4px; font-size: 16px;">Q3 Planning Meeting</strong>
              <span style="font-size: 14px; color: #4b5563; line-height: 1.5;">Discussed product roadmap, set OKRs, and allocated resources for the upcoming quarter.</span>
            </li>
            <li style="margin-bottom: 12px; padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
              <strong style="color: #4f46e5; display: block; margin-bottom: 4px; font-size: 16px;">Weekly Sync: Engineering</strong>
              <span style="font-size: 14px; color: #4b5563; line-height: 1.5;">Reviewed sprint progress and addressed blockers in the CI pipeline.</span>
            </li>
          </ul>
        </div>
      `;
    }

    if (
      sections.includes("action_items") ||
      sections.includes("action-items")
    ) {
      html += `
        <div style="margin-bottom: 24px;">
          <h3 style="color: #111827; border-bottom: 2px solid #f3f4f6; padding-bottom: 8px; margin-bottom: 16px; font-size: 18px;">Action Items</h3>
          <ul style="list-style-type: none; padding-left: 0; margin: 0;">
            <li style="margin-bottom: 12px; padding: 12px 16px; background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 0 8px 8px 0; display: flex; align-items: flex-start; gap: 12px;">
              <div style="margin-top: 2px;">⬜</div>
              <div>
                 <div style="font-weight: 500; color: #92400e;">Finalize Q3 budget</div>
                 <div style="font-size: 12px; color: #b45309; margin-top: 4px;">Due: Tomorrow</div>
              </div>
            </li>
            <li style="margin-bottom: 12px; padding: 12px 16px; background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 0 8px 8px 0; display: flex; align-items: flex-start; gap: 12px;">
              <div style="margin-top: 2px;">⬜</div>
              <div>
                 <div style="font-weight: 500; color: #92400e;">Schedule performance reviews</div>
                 <div style="font-size: 12px; color: #b45309; margin-top: 4px;">Due: Next week</div>
              </div>
            </li>
          </ul>
        </div>
      `;
    }

    if (sections.includes("decisions")) {
      html += `
        <div style="margin-bottom: 24px;">
          <h3 style="color: #111827; border-bottom: 2px solid #f3f4f6; padding-bottom: 8px; margin-bottom: 16px; font-size: 18px;">Key Decisions</h3>
          <ul style="list-style-type: none; padding-left: 0; margin: 0;">
            <li style="margin-bottom: 12px; padding: 12px 16px; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 0 8px 8px 0;">
              <strong style="color: #1e40af; display: inline-block; margin-bottom: 4px;">Approved:</strong>
              <div style="color: #1e3a8a; font-size: 14px;">Switch to new CI/CD pipeline provider starting next month.</div>
            </li>
          </ul>
        </div>
      `;
    }

    if (sections.length === 0) {
      html += `
        <div style="padding: 24px; background: #f9fafb; border-radius: 8px; text-align: center; color: #6b7280;">
          <p>You haven't selected any sections to include in your digest.</p>
        </div>
      `;
    }

    html += `
          <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center;">
             <p style="font-size: 12px; color: #9ca3af; margin: 0;">
               You are receiving this email because of your Digest Preferences in MeetOnMemory.
             </p>
             <p style="font-size: 12px; color: #9ca3af; margin: 4px 0 0 0;">
               <a href="#" style="color: #4f46e5; text-decoration: none;">Update preferences</a>
             </p>
          </div>
        </div>
      </div>
    `;

    res.status(200).json({ success: true, html });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error generating digest preview",
      error: error.message,
    });
  }
};

/**
 * @desc Send a real test digest to the user's email
 * @route POST /api/digest-preferences/test
 * @access Private
 */
export const sendTestDigest = async (req, res) => {
  try {
    const userId = req.user._id;
    const preferences = req.body || {};

    // 1. Validate that we have a user to send to
    const user = await User.findById(userId).select("email name");
    if (!user || !user.email) {
      return res.status(400).json({
        success: false,
        message: "Unable to send test digest: User email not found in profile.",
      });
    }

    // 2. Generate the actual HTML content based on the provided preferences
    let htmlContent = "";
    try {
      htmlContent = await MeetingDigestService.buildDigestHtml(
        user,
        preferences,
      );
    } catch (htmlError) {
      console.error(
        "Error generating digest HTML for test, using fallback:",
        htmlError,
      );
      htmlContent = `
        <div style="font-family: sans-serif; padding: 24px; color: #334155; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5; margin-bottom: 16px;">Your MeetOnMemory Test Digest</h2>
          <p>Hello ${user.name || "User"},</p>
          <p>This is a test of your configured digest preferences to ensure delivery is working correctly.</p>
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #e2e8f0;">
            <p style="margin: 0 0 8px 0;"><strong>Frequency:</strong> ${
              preferences.frequency || "Weekly"
            }</p>
            <p style="margin: 0;"><strong>Sections:</strong> ${
              (preferences.includeSections || []).join(", ") || "None"
            }</p>
          </div>
          <p style="margin-top: 24px; color: #64748b; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            Sent by MeetOnMemory Digest System
          </p>
        </div>
      `;
    }

    // 3. Attempt to send the real email via the configured service
    const emailOptions = {
      to: user.email,
      subject: `[TEST] Your MeetOnMemory Digest Preview`,
      html: htmlContent,
    };

    console.log(
      `[Digest Test] Attempting to send test digest to ${user.email}...`,
    );

    // Execute the email send. This will throw if the email service fails.
    await transporter.sendMail(emailOptions);

    console.log(`[Digest Test] Test digest successfully sent to ${user.email}`);

    // 4. Return success ONLY after the email request completes successfully
    return res.status(200).json({
      success: true,
      message: `Test digest sent successfully to ${user.email}. Please check your inbox.`,
    });
  } catch (error) {
    console.error("[Digest Test] CRITICAL: Error sending test digest:", error);

    // Return a meaningful error to the frontend
    return res.status(500).json({
      success: false,
      message:
        "Failed to send test digest. Please check your email configuration or try again later.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
