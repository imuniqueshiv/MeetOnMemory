import CustomFieldDefinition from '../models/customFieldDefinitionModel.js'
import CustomFieldValue from '../models/customFieldValueModel.js'

class CustomFieldService {
  async createDefinition(orgId, data) {
    if (
      data.type === 'dropdown' &&
      (!data.options || !Array.isArray(data.options) || data.options.length === 0)
    ) {
      throw new Error('Dropdown fields require options')
    }
    const def = new CustomFieldDefinition({
      organization: orgId,
      ...data,
    })
    await def.save()
    return def
  }

  async getDefinitions(orgId, activeOnly = true) {
    const query = { organization: orgId }
    if (activeOnly) {
      query.active = true
    }
    return CustomFieldDefinition.find(query).sort({ createdAt: 1 })
  }

  async updateDefinition(id, orgId, data) {
    const def = await CustomFieldDefinition.findOne({
      _id: id,
      organization: orgId,
    })
    if (!def) throw new Error('Definition not found')

    if (data.options !== undefined) def.options = data.options
    if (data.name !== undefined) def.name = data.name
    if (data.required !== undefined) def.required = data.required
    if (data.active !== undefined) def.active = data.active

    await def.save()
    return def
  }

  async deleteDefinition(id, orgId) {
    const def = await CustomFieldDefinition.findOneAndDelete({
      _id: id,
      organization: orgId,
    })
    if (!def) throw new Error('Definition not found')
    await CustomFieldValue.deleteMany({ fieldDefinition: id })
    return def
  }

  async setMeetingFields(meetingId, orgId, fieldsData) {
    const definitions = await CustomFieldDefinition.find({
      organization: orgId,
      active: true,
    })
    const defMap = new Map(definitions.map((d) => [d._id.toString(), d]))

    const bulkOps = []
    const providedFields = new Set()

    for (const field of fieldsData) {
      const def = defMap.get(field.definitionId)
      if (!def) continue

      providedFields.add(field.definitionId)

      this.validateValue(field.value, def)

      bulkOps.push({
        updateOne: {
          filter: { meeting: meetingId, fieldDefinition: field.definitionId },
          update: { $set: { value: field.value } },
          upsert: true,
        },
      })
    }

    for (const def of definitions) {
      if (def.required && !providedFields.has(def._id.toString())) {
        throw new Error(`Field ${def.name} is required`)
      }
    }

    // Always try to remove missing required fields and others if needed?
    // Actually if a field is not provided, maybe we delete it if not required?
    // Let's delete fields that are not provided
    const providedIds = Array.from(providedFields)
    await CustomFieldValue.deleteMany({
      meeting: meetingId,
      fieldDefinition: { $nin: providedIds },
    })

    if (bulkOps.length > 0) {
      await CustomFieldValue.bulkWrite(bulkOps)
    }
  }

  validateValue(value, definition) {
    if (value === null || value === undefined || value === '') {
      if (definition.required) {
        throw new Error(`Field ${definition.name} is required`)
      }
      return
    }

    switch (definition.type) {
      case 'number':
        if (typeof value !== 'number' && isNaN(Number(value))) {
          throw new Error(`Field ${definition.name} must be a number`)
        }
        break
      case 'checkbox':
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          throw new Error(`Field ${definition.name} must be a boolean`)
        }
        break
      case 'date':
        if (isNaN(Date.parse(value))) {
          throw new Error(`Field ${definition.name} must be a valid date`)
        }
        break
      case 'dropdown':
        if (definition.options && !definition.options.includes(value)) {
          throw new Error(`Value ${value} is not a valid option for ${definition.name}`)
        }
        break
      case 'text':
      default:
        break
    }
  }

  async getMeetingFields(meetingId) {
    return CustomFieldValue.find({ meeting: meetingId }).populate('fieldDefinition')
  }
}

export default new CustomFieldService()
