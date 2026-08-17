import { jest } from '@jest/globals'
import mongoose from 'mongoose'

// Mock dependencies with pass-through implementations for ESM runtime isolation
const mockFindOne = jest.fn()
const mockFindById = jest.fn()
const mockCreate = jest.fn()
const mockFindOneAndUpdate = jest.fn()
const mockFind = jest.fn()

jest.unstable_mockModule('../models/meetingSeriesModel.js', () => ({
  default: {
    findById: mockFindById,
    findOne: mockFindOne,
  },
}))

jest.unstable_mockModule('../models/carryForwardConfigModel.js', () => ({
  default: {
    findOne: mockFindOne,
    create: mockCreate,
    findOneAndUpdate: mockFindOneAndUpdate,
  },
}))

jest.unstable_mockModule('../models/meetingModel.js', () => ({
  default: {
    findOne: mockFindOne,
    find: mockFind,
  },
}))

const {
  verifySeriesOwnership,
  getCarryForwardConfig,
  updateCarryForwardConfig,
  generateCarryForwardPreview,
  applyCarryForwardToMeeting,
} = await import('../services/carryForwardService.js')

const { getConfig, updateConfig, getPreview, applyCarryForward } =
  await import('../controllers/carryForwardController.js')

describe('Carry-Forward Cross-Tenant Ownership & Authorization Security Suite (#1666)', () => {
  const orgA = new mongoose.Types.ObjectId().toString()
  const orgB = new mongoose.Types.ObjectId().toString()
  const userIdA = new mongoose.Types.ObjectId().toString()
  const seriesIdA = new mongoose.Types.ObjectId().toString()
  const seriesIdB = new mongoose.Types.ObjectId().toString()
  const meetingIdA = new mongoose.Types.ObjectId().toString()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('verifySeriesOwnership Service Security', () => {
    it('should throw 404 if series does not exist', async () => {
      mockFindById.mockResolvedValue(null)

      await expect(verifySeriesOwnership(seriesIdA, orgA)).rejects.toThrow(
        'Meeting series not found',
      )
    })

    it('should throw 403 Forbidden if series belongs to a different organization (IDOR attempt)', async () => {
      mockFindById.mockResolvedValue({
        _id: seriesIdB,
        title: 'Foreign Org Series',
        organization: orgB,
      })

      await expect(verifySeriesOwnership(seriesIdB, orgA)).rejects.toThrow(
        'Forbidden: Access denied to foreign meeting series',
      )
    })

    it('should succeed and return series if organization matches', async () => {
      const seriesObj = {
        _id: seriesIdA,
        title: 'Same Org Series',
        organization: orgA,
      }
      mockFindById.mockResolvedValue(seriesObj)

      const result = await verifySeriesOwnership(seriesIdA, orgA)
      expect(result).toBe(seriesObj)
    })
  })

  describe('Cross-Tenant Configuration Isolation', () => {
    it('should prevent reading configuration for a foreign organization series', async () => {
      mockFindById.mockResolvedValue({
        _id: seriesIdB,
        organization: orgB,
      })

      await expect(getCarryForwardConfig(seriesIdB, orgA, userIdA)).rejects.toThrow(
        'Forbidden: Access denied to foreign meeting series',
      )
    })

    it('should return config for valid same-organization series', async () => {
      mockFindById.mockResolvedValue({
        _id: seriesIdA,
        organization: orgA,
      })
      mockFindOne.mockResolvedValue({
        series: seriesIdA,
        organization: orgA,
        enabled: true,
      })

      const config = await getCarryForwardConfig(seriesIdA, orgA, userIdA)
      expect(config.enabled).toBe(true)
    })
  })

  describe('Cross-Tenant Preview Isolation', () => {
    it('should block preview generation for a foreign series', async () => {
      mockFindById.mockResolvedValue({
        _id: seriesIdB,
        organization: orgB,
      })

      await expect(generateCarryForwardPreview(seriesIdB, orgA)).rejects.toThrow(
        'Forbidden: Access denied to foreign meeting series',
      )
    })

    it('should generate preview items for same-organization series', async () => {
      mockFindById.mockResolvedValue({
        _id: seriesIdA,
        title: 'Org A Weekly Sync',
        organization: orgA,
      })
      mockFindOne.mockResolvedValue({
        series: seriesIdA,
        organization: orgA,
        enabled: true,
        carrySkippedAgendaItems: true,
        carryUnfinishedActionItems: true,
        maxItemsToCarry: 10,
      })
      mockFind.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([
          {
            _id: 'm_prev_1',
            title: 'Previous Meeting 1',
            date: new Date(),
            agendaItems: [
              { text: 'Unfinished item', status: 'skipped', description: 'Refactor auth' },
            ],
            structuredMoM: {
              action_items: [
                { task: 'Fix IDOR vulnerability', status: 'pending', assignee: 'Shiv' },
              ],
            },
          },
        ]),
      })

      const preview = await generateCarryForwardPreview(seriesIdA, orgA)
      expect(preview.enabled).toBe(true)
      expect(preview.previewItems).toHaveLength(2)
      expect(preview.previewItems[0].text).toBe('Unfinished item')
    })
  })

  describe('Cross-Tenant Apply Isolation', () => {
    it('should reject applying carry-forward to a foreign series', async () => {
      mockFindById.mockResolvedValue({
        _id: seriesIdB,
        organization: orgB,
      })

      await expect(applyCarryForwardToMeeting(seriesIdB, meetingIdA, orgA)).rejects.toThrow(
        'Forbidden: Access denied to foreign meeting series',
      )
    })
  })

  describe('CarryForwardController Unit Isolation', () => {
    it('getConfig returns 403 when cross-tenant access is attempted', async () => {
      mockFindById.mockResolvedValue({
        _id: seriesIdB,
        organization: orgB,
      })

      const req = {
        params: { seriesId: seriesIdB },
        user: { organization: orgA, _id: userIdA },
      }
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }

      await getConfig(req, res)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Forbidden: Access denied to foreign meeting series',
        }),
      )
    })

    it('getPreview returns 403 when cross-tenant preview is attempted', async () => {
      mockFindById.mockResolvedValue({
        _id: seriesIdB,
        organization: orgB,
      })

      const req = {
        params: { seriesId: seriesIdB },
        query: {},
        user: { organization: orgA, _id: userIdA },
      }
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }

      await getPreview(req, res)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Forbidden: Access denied to foreign meeting series',
        }),
      )
    })

    it('applyCarryForward returns 403 when cross-tenant apply is attempted', async () => {
      mockFindById.mockResolvedValue({
        _id: seriesIdB,
        organization: orgB,
      })

      const req = {
        params: { seriesId: seriesIdB },
        body: { targetMeetingId: meetingIdA },
        user: { organization: orgA, _id: userIdA },
      }
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }

      await applyCarryForward(req, res)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Forbidden: Access denied to foreign meeting series',
        }),
      )
    })
  })
})
