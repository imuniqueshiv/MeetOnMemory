import { z } from 'zod'
import customFieldService from '../services/customFieldService.js'

const createDefinitionSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['text', 'number', 'dropdown', 'date', 'checkbox']),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
})

export const createDefinition = async (req, res) => {
  try {
    const orgId = req.params.orgId

    // Auth Check: only admins/owners should do this (handled by middleware ideally)
    const payload = createDefinitionSchema.parse(req.body)

    const def = await customFieldService.createDefinition(orgId, payload)
    res.status(201).json({ success: true, data: def })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.errors })
    }
    res.status(400).json({ success: false, message: error.message })
  }
}

export const getDefinitions = async (req, res) => {
  try {
    const orgId = req.params.orgId
    const defs = await customFieldService.getDefinitions(orgId, false)
    res.status(200).json({ success: true, data: defs })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

const updateDefinitionSchema = z.object({
  name: z.string().min(1).optional(),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
  active: z.boolean().optional(),
})

export const updateDefinition = async (req, res) => {
  try {
    const { orgId, id } = req.params
    const payload = updateDefinitionSchema.parse(req.body)
    const updated = await customFieldService.updateDefinition(id, orgId, payload)
    res.status(200).json({ success: true, data: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: error.errors })
    }
    res.status(400).json({ success: false, message: error.message })
  }
}

export const deleteDefinition = async (req, res) => {
  try {
    const { orgId, id } = req.params
    const deleted = await customFieldService.deleteDefinition(id, orgId)
    res.status(200).json({ success: true, data: deleted })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
}

export const setMeetingFields = async (req, res) => {
  try {
    const { meetingId } = req.params
    // Assume req.meeting is populated by middleware and we can check org
    const orgId = req.body.orgId || req.user?.organization
    const fieldsData = req.body.fields // array of { definitionId, value }

    if (!orgId) {
      return res.status(400).json({ success: false, message: 'Organization ID is required' })
    }

    await customFieldService.setMeetingFields(meetingId, orgId, fieldsData)
    res.status(200).json({ success: true, message: 'Fields updated' })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
}

export const getMeetingFields = async (req, res) => {
  try {
    const { meetingId } = req.params
    const fields = await customFieldService.getMeetingFields(meetingId)
    res.status(200).json({ success: true, data: fields })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}
