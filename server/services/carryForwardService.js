import mongoose from 'mongoose'
import CarryForwardConfig from '../models/carryForwardConfigModel.js'
import MeetingSeries from '../models/meetingSeriesModel.js'
import Meeting from '../models/meetingModel.js'

/**
 * Verifies that the meeting series exists and belongs to the authenticated user's organization.
 * Fails closed with an error object if non-existent or unauthorized.
 */
export const verifySeriesOwnership = async (seriesId, userOrganizationId) => {
  if (
    !seriesId ||
    !mongoose.Types.ObjectId.isValid(seriesId) ||
    !mongoose.Types.ObjectId.isValid(userOrganizationId)
  ) {
    const error = new Error('Invalid Meeting Series ID or Organization ID')
    error.statusCode = 400
    throw error
  }

  const series = await MeetingSeries.findById(seriesId)

  if (!series) {
    const error = new Error('Meeting series not found')
    error.statusCode = 404
    throw error
  }

  if (!series.organization || series.organization.toString() !== userOrganizationId.toString()) {
    const error = new Error('Forbidden: Access denied to foreign meeting series')
    error.statusCode = 403
    throw error
  }

  return series
}

/**
 * Gets or creates default carry-forward configuration for a series after verifying organization ownership.
 */
export const getCarryForwardConfig = async (seriesId, userOrgId, userId = null) => {
  const series = await verifySeriesOwnership(seriesId, userOrgId)

  let config = await CarryForwardConfig.findOne({
    series: series._id,
    organization: userOrgId,
  })

  if (!config) {
    config = await CarryForwardConfig.create({
      series: series._id,
      organization: userOrgId,
      createdBy: userId || new mongoose.Types.ObjectId(),
      enabled: true,
      carryUnfinishedActionItems: true,
      carrySkippedAgendaItems: true,
      carryOpenTopics: false,
      maxItemsToCarry: 20,
    })
  }

  return config
}

/**
 * Updates carry-forward configuration strictly scoped to user's organization.
 */
export const updateCarryForwardConfig = async (seriesId, userOrgId, userId, updateData) => {
  const series = await verifySeriesOwnership(seriesId, userOrgId)

  const allowedUpdates = {
    enabled: updateData.enabled,
    carryUnfinishedActionItems: updateData.carryUnfinishedActionItems,
    carrySkippedAgendaItems: updateData.carrySkippedAgendaItems,
    carryOpenTopics: updateData.carryOpenTopics,
    maxItemsToCarry: updateData.maxItemsToCarry,
    autoApplyOnCreate: updateData.autoApplyOnCreate,
    updatedBy: userId,
  }

  // Remove undefined fields
  Object.keys(allowedUpdates).forEach(
    (key) => allowedUpdates[key] === undefined && delete allowedUpdates[key],
  )

  const config = await CarryForwardConfig.findOneAndUpdate(
    { series: series._id, organization: userOrgId },
    { $set: allowedUpdates, $setOnInsert: { createdBy: userId || new mongoose.Types.ObjectId() } },
    { new: true, upsert: true, runValidators: true },
  )

  return config
}

/**
 * Generates a preview of carry-forward items from previous meetings in a series for a target meeting.
 */
export const generateCarryForwardPreview = async (
  seriesId,
  userOrgId,
  targetMeetingId = null,
  userId = null,
) => {
  const series = await verifySeriesOwnership(seriesId, userOrgId)

  const config = await getCarryForwardConfig(seriesId, userOrgId, userId)

  if (!config.enabled) {
    return {
      enabled: false,
      seriesId: series._id,
      previewItems: [],
      summary: 'Carry-forward is currently disabled for this meeting series.',
    }
  }

  // Find previous meetings in the same series & organization
  const query = {
    series: series._id,
    organization: userOrgId,
  }

  if (targetMeetingId) {
    const targetMeeting = await Meeting.findOne({
      _id: targetMeetingId,
      organization: userOrgId,
      series: series._id,
    })

    if (!targetMeeting) {
      const error = new Error('Target meeting not found or does not belong to series')
      error.statusCode = 404
      throw error
    }

    query.date = { $lt: targetMeeting.date }
  }

  const previousMeetings = await Meeting.find(query).sort({ date: -1 }).limit(5)

  const previewItems = []

  for (const meeting of previousMeetings) {
    // Extract unfinished agenda items if configured
    if (config.carrySkippedAgendaItems && Array.isArray(meeting.agendaItems)) {
      meeting.agendaItems.forEach((item) => {
        if (item.status === 'skipped' || item.status === 'pending') {
          previewItems.push({
            type: 'agenda_item',
            sourceMeetingId: meeting._id,
            sourceMeetingTitle: meeting.title,
            sourceMeetingDate: meeting.date,
            text: item.text,
            description: item.description || '',
            status: item.status,
          })
        }
      })
    }

    // Extract unfinished action items from structuredMoM if present
    if (
      config.carryUnfinishedActionItems &&
      meeting.structuredMoM &&
      Array.isArray(meeting.structuredMoM.action_items)
    ) {
      meeting.structuredMoM.action_items.forEach((actionItem) => {
        if (actionItem.status !== 'completed' && actionItem.status !== 'done') {
          previewItems.push({
            type: 'action_item',
            sourceMeetingId: meeting._id,
            sourceMeetingTitle: meeting.title,
            sourceMeetingDate: meeting.date,
            text: actionItem.task || actionItem.text || actionItem.description,
            assignee: actionItem.assignee || '',
            dueDate: actionItem.dueDate || null,
            status: actionItem.status || 'pending',
          })
        }
      })
    }
  }

  const limitedPreviewItems = previewItems.slice(0, config.maxItemsToCarry)

  return {
    enabled: true,
    seriesId: series._id,
    seriesTitle: series.title,
    organizationId: userOrgId,
    previewItems: limitedPreviewItems,
    totalCount: limitedPreviewItems.length,
  }
}

/**
 * Applies carry-forward items to a specific meeting in the series after verifying series ownership.
 */
export const applyCarryForwardToMeeting = async (
  seriesId,
  targetMeetingId,
  userOrgId,
  customItems = null,
  userId = null,
) => {
  const series = await verifySeriesOwnership(seriesId, userOrgId)

  const targetMeeting = await Meeting.findOne({
    _id: targetMeetingId,
    series: series._id,
    organization: userOrgId,
  })

  if (!targetMeeting) {
    const error = new Error(
      'Target meeting not found or does not belong to this series/organization',
    )
    error.statusCode = 404
    throw error
  }

  let itemsToApply = customItems

  if (!itemsToApply || !Array.isArray(itemsToApply)) {
    const previewResult = await generateCarryForwardPreview(
      seriesId,
      userOrgId,
      targetMeetingId,
      userId,
    )
    itemsToApply = previewResult.previewItems
  }

  const config = await getCarryForwardConfig(seriesId, userOrgId, userId)
  const safeItems = itemsToApply.slice(0, config.maxItemsToCarry)

  const newAgendaItems = safeItems.map((item) => ({
    text: `[Carry-Forward] ${item.text}`,
    description: `Carried forward from ${item.sourceMeetingTitle || 'previous meeting'}. ${item.description || ''}`,
    duration: item.duration || 10,
    status: 'pending',
  }))

  targetMeeting.agendaItems.push(...newAgendaItems)
  await targetMeeting.save()

  return {
    success: true,
    targetMeetingId: targetMeeting._id,
    appliedCount: newAgendaItems.length,
    updatedAgendaItems: targetMeeting.agendaItems,
  }
}
