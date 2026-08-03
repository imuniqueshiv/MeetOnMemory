import SpeakerMapping from "../models/speakerMappingModel.js";
import speakerIdentificationService from "../services/speakerIdentificationService.js";

/**
 * Get mappings for a meeting
 */
export const getMappings = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const mappings = await SpeakerMapping.find({ meeting: meetingId });
    res.status(200).json({ success: true, data: mappings });
  } catch (error) {
    console.error("Error getting mappings:", error);
    res.status(500).json({ success: false, message: "Failed to get mappings" });
  }
};

/**
 * Get auto-suggestions for mappings
 */
export const suggestMappings = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const suggestions =
      await speakerIdentificationService.suggestMappings(meetingId);
    res.status(200).json({ success: true, data: suggestions });
  } catch (error) {
    console.error("Error suggesting mappings:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to suggest mappings" });
  }
};

/**
 * Create or update a mapping and apply it
 */
export const saveAndApplyMapping = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { originalLabel, mappedName } = req.body;
    const userId = req.user._id;

    if (!originalLabel || !mappedName) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    // Upsert the mapping record
    const mapping = await SpeakerMapping.findOneAndUpdate(
      { meeting: meetingId, originalLabel },
      {
        mappedName,
        isConfirmed: true,
        createdBy: userId,
      },
      { new: true, upsert: true },
    );

    // Apply the mapping to Transcript, Meeting Summary, and Action Items
    await speakerIdentificationService.applyMapping(
      meetingId,
      originalLabel,
      mappedName,
    );

    res.status(200).json({ success: true, data: mapping });
  } catch (error) {
    console.error("Error saving mapping:", error);
    res.status(500).json({ success: false, message: "Failed to save mapping" });
  }
};

/**
 * Revert a mapping (sets transcript back to original label, though practically it's hard to revert summaries without saving history.
 * For this task, we will just apply a reverse mapping).
 */
export const revertMapping = async (req, res) => {
  try {
    const { meetingId, mappingId } = req.params;

    const mapping = await SpeakerMapping.findOne({
      _id: mappingId,
      meeting: meetingId,
    });
    if (!mapping) {
      return res
        .status(404)
        .json({ success: false, message: "Mapping not found" });
    }

    // Apply reverse mapping
    await speakerIdentificationService.applyMapping(
      meetingId,
      mapping.mappedName,
      mapping.originalLabel,
    );

    // Delete the mapping record
    await SpeakerMapping.findByIdAndDelete(mappingId);

    res
      .status(200)
      .json({ success: true, message: "Mapping reverted successfully" });
  } catch (error) {
    console.error("Error reverting mapping:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to revert mapping" });
  }
};
