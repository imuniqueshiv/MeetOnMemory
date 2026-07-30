import DigestPreference from "../models/digestPreferenceModel.js";

// @desc    Get user digest preferences
// @route   GET /api/digest-preferences
// @access  Private
export const getPreferences = async (req, res) => {
  try {
    let preferences = await DigestPreference.findOne({
      user: req.user._id,
    }).populate("filterByTags", "name color");

    if (!preferences) {
      preferences = await DigestPreference.create({ user: req.user._id });
    }

    res.status(200).json(preferences);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching digest preferences",
      error: error.message,
    });
  }
};

// @desc    Update user digest preferences
// @route   PUT /api/digest-preferences
// @access  Private
export const updatePreferences = async (req, res) => {
  try {
    const {
      frequency,
      deliveryDay,
      deliveryHour,
      includeSections,
      filterByTags,
      maxItems,
    } = req.body;

    let preferences = await DigestPreference.findOne({ user: req.user._id });

    if (!preferences) {
      preferences = new DigestPreference({
        user: req.user._id,
      });
    }

    if (frequency) preferences.frequency = frequency;
    if (deliveryDay !== undefined) preferences.deliveryDay = deliveryDay;
    if (deliveryHour !== undefined) preferences.deliveryHour = deliveryHour;
    if (includeSections) preferences.includeSections = includeSections;
    if (filterByTags) preferences.filterByTags = filterByTags;
    if (maxItems !== undefined) preferences.maxItems = maxItems;

    await preferences.save();

    res.status(200).json(preferences);
  } catch (error) {
    res.status(500).json({
      message: "Error updating digest preferences",
      error: error.message,
    });
  }
};

// @desc    Preview digest content without sending
// @route   POST /api/digest-preferences/preview
// @access  Private
export const previewDigest = async (req, res) => {
  try {
    const preferences = req.body; // Can be unsaved preferences from frontend state

    // In a real app, this would query meetings/action items based on preferences
    // and generate an HTML string. For now, we generate a mock preview based on preferences.
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

    if (sections.includes("action_items")) {
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

    res.status(200).json({ html });
  } catch (error) {
    res.status(500).json({
      message: "Error generating digest preview",
      error: error.message,
    });
  }
};

// @desc    Send test digest
// @route   POST /api/digest-preferences/test
// @access  Private
export const sendTestDigest = async (req, res) => {
  try {
    // Simulate email delivery latency
    await new Promise((resolve) => setTimeout(resolve, 1000));

    res
      .status(200)
      .json({ message: "Test digest sent successfully to your email." });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error sending test digest", error: error.message });
  }
};
