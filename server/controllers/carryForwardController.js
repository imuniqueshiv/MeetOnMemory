import {
  getCarryForwardConfig,
  updateCarryForwardConfig,
  generateCarryForwardPreview,
  applyCarryForwardToMeeting,
} from '../services/carryForwardService.js'

/**
 * Controller to fetch carry-forward config for a series.
 * Enforces organization ownership of series and ignores any client-supplied org ID.
 */
export const getConfig = async (req, res) => {
  try {
    const { seriesId } = req.params
    const userOrgId = req.user?.organization

    const config = await getCarryForwardConfig(seriesId, userOrgId, req.user?._id)

    return res.status(200).json({
      success: true,
      config,
    })
  } catch (error) {
    const statusCode = error.statusCode || 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Server error fetching carry-forward configuration',
    })
  }
}

/**
 * Controller to update carry-forward config for a series.
 * Strictly uses req.user.organization to prevent cross-tenant parameter tampering.
 */
export const updateConfig = async (req, res) => {
  try {
    const { seriesId } = req.params
    const userOrgId = req.user?.organization

    const config = await updateCarryForwardConfig(seriesId, userOrgId, req.user?._id, req.body)

    return res.status(200).json({
      success: true,
      message: 'Carry-forward configuration updated successfully',
      config,
    })
  } catch (error) {
    const statusCode = error.statusCode || 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Server error updating carry-forward configuration',
    })
  }
}

/**
 * Controller to generate carry-forward preview for a series.
 */
export const getPreview = async (req, res) => {
  try {
    const { seriesId } = req.params
    const { targetMeetingId } = req.query
    const userOrgId = req.user?.organization

    const preview = await generateCarryForwardPreview(
      seriesId,
      userOrgId,
      targetMeetingId,
      req.user?._id,
    )

    return res.status(200).json({
      success: true,
      preview,
    })
  } catch (error) {
    const statusCode = error.statusCode || 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Server error generating carry-forward preview',
    })
  }
}

/**
 * Controller to apply carry-forward items to a target meeting in a series.
 */
export const applyCarryForward = async (req, res) => {
  try {
    const { seriesId } = req.params
    const { targetMeetingId, items } = req.body
    const userOrgId = req.user?.organization

    if (!targetMeetingId) {
      return res.status(400).json({
        success: false,
        message: 'targetMeetingId is required in body',
      })
    }

    const result = await applyCarryForwardToMeeting(
      seriesId,
      targetMeetingId,
      userOrgId,
      items,
      req.user?._id,
    )

    return res.status(200).json({
      success: true,
      message: 'Carry-forward items applied successfully',
      result,
    })
  } catch (error) {
    const statusCode = error.statusCode || 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Server error applying carry-forward items',
    })
  }
}
