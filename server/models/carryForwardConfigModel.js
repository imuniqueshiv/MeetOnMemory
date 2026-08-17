import mongoose from 'mongoose'

const carryForwardConfigSchema = new mongoose.Schema(
  {
    series: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MeetingSeries',
      required: true,
      unique: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    carryUnfinishedActionItems: {
      type: Boolean,
      default: true,
    },
    carrySkippedAgendaItems: {
      type: Boolean,
      default: true,
    },
    carryOpenTopics: {
      type: Boolean,
      default: false,
    },
    maxItemsToCarry: {
      type: Number,
      default: 20,
      min: 1,
      max: 100,
    },
    targetStatusFilter: {
      type: [String],
      default: ['pending', 'skipped', 'in_progress'],
    },
    autoApplyOnCreate: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
)

carryForwardConfigSchema.index({ series: 1, organization: 1 })
carryForwardConfigSchema.index({ organization: 1 })

const CarryForwardConfig = mongoose.model('CarryForwardConfig', carryForwardConfigSchema)

export default CarryForwardConfig
